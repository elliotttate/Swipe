const CLICKUP_DOMAIN = 'app.clickup.com';
const TARGET_COOKIE = 'cu_jwt';
const SWIPE_URL = 'http://localhost:5173';

/**
 * Get the cu_jwt token from ClickUp cookies.
 */
async function getAuthToken() {
  try {
    const cookie = await chrome.cookies.get({
      url: `https://${CLICKUP_DOMAIN}`,
      name: TARGET_COOKIE
    });

    if (!cookie) {
      return {
        token: null,
        error: 'cu_jwt cookie not found. Make sure you are logged into ClickUp.',
        tokenInfo: null
      };
    }

    const tokenInfo = parseJwt(cookie.value);
    return { token: cookie.value, tokenInfo, error: null };
  } catch (error) {
    return { token: null, error: error?.message || 'Failed to read cookies', tokenInfo: null };
  }
}

/**
 * Parse JWT payload to extract useful info
 */
function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    const expDate = payload.exp ? new Date(payload.exp * 1000) : null;
    const now = new Date();

    return {
      userId: payload.user,
      workspaceKey: payload.ws_key,
      issuedAt: payload.iat ? new Date(payload.iat * 1000) : null,
      expiresAt: expDate,
      isExpired: expDate ? now > expDate : false,
      hoursUntilExpiry: expDate ? Math.round((expDate - now) / (1000 * 60 * 60)) : null,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Fetch inbox data from ClickUp's v3 API
 * Must be called from within a ClickUp tab context
 */
async function fetchInboxFromTab(tabId, workspaceId, jwtToken) {
  // Inject script to fetch inbox from within the page context
  // Use MAIN world to share the page's session/cookies
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (wsId, jwtToken) => {
      const allNotifications = [];
      let cursor = null;
      let pageCount = 0;
      const maxPages = 10; // Safety limit

      // Get workspace ID from the page URL (more reliable than token)
      const urlMatch = window.location.href.match(/\/(\d+)\//);
      const actualWsId = (urlMatch ? urlMatch[1] : null) || wsId;

      console.log('[Swipe] Using workspace ID:', actualWsId, 'from URL:', urlMatch?.[1], 'from param:', wsId);
      console.log('[Swipe] JWT token provided:', jwtToken ? 'yes (' + jwtToken.substring(0, 20) + '...)' : 'no');

      if (!actualWsId) {
        return { success: false, error: 'Could not determine workspace ID from URL or token' };
      }

      try {
        do {
          // Build request body matching ClickUp's exact format - pagination is ALWAYS required
          const body = {
            filteredBy: {
              bundleType: 'messages',
              status: 'uncleared',
              saved: false,
              assignedToMe: false,
              mentioned: false,
              unread: false,
              reminders: false
            },
            pagination: {
              nextCursor: cursor || '',
              limit: 20
            },
            sortedBy: { direction: 'descending' },
            needsMemberMap: false
          };

          // Use the correct frontdoor API domain
          const url = `https://frontdoor-prod-us-west-2-2.clickup.com/inbox/v3/workspaces/${actualWsId}/notifications/bundles/search`;
          console.log('[Swipe] Fetching:', url);

          // Generate a random session ID like ClickUp does
          const sessionId = Math.random().toString(36).substring(2, 12);

          const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'x-csrf': '1',
            'x-workspace-id': actualWsId,
            'sessionid': sessionId,
            'Origin': 'https://app.clickup.com',
            'Referer': `https://app.clickup.com/${actualWsId}/inbox?tab=primary`,
          };

          // Add JWT as Authorization header if provided
          if (jwtToken) {
            headers['Authorization'] = `Bearer ${jwtToken}`;
          }

          const response = await fetch(
            url,
            {
              method: 'POST',
              headers,
              credentials: 'include',
              body: JSON.stringify(body)
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const text = await response.text();
          console.log('[Swipe] Response status:', response.status, 'length:', text.length);
          console.log('[Swipe] Response preview:', text.substring(0, 200));

          // Check if we got HTML instead of JSON (login page)
          if (text.trim().startsWith('<')) {
            console.error('[Swipe] Got HTML response instead of JSON');
            throw new Error('Got HTML instead of JSON. Status: ' + response.status + '. Check console for details.');
          }

          const data = JSON.parse(text);
          console.log('[Swipe] Response keys:', Object.keys(data));

          // Extract notifications from bundle groups
          const groups = data.notificationBundleGroups || [];
          const resources = data.resources || [];

          console.log('[Swipe] Found', groups.length, 'groups,', resources.length, 'resources');

          for (const group of groups) {
            const bundles = group.notificationBundles || [];
            for (const bundle of bundles) {
              // Find matching task resource using rootEntityResourceName
              const taskResource = resources.find(r =>
                r.entityResourceName === bundle.rootEntityResourceName && r.type === 'task'
              );

              // Get comment preview text
              let commentText = '';
              if (bundle.mostRecentCommentNotification?.commentPreview) {
                commentText = bundle.mostRecentCommentNotification.commentPreview
                  .map(c => c.text || '')
                  .join('')
                  .trim();
              }

              // Get notification type description
              const notifType = bundle.previewNotification?.type || bundle.bundleType || '';
              const typeLabels = {
                'assignee_add': 'Assigned to you',
                'due_date_missed': 'Due date missed',
                'comment': 'New comment',
                'task_created': 'Task created',
                'status_change': 'Status changed',
                'messages': 'Message'
              };

              allNotifications.push({
                id: bundle.id,
                bundle_id: bundle.id,
                task_id: taskResource?.id || bundle.rootEntityResourceName?.split(':').pop(),
                name: taskResource?.name || 'Unknown Task',
                description: commentText || typeLabels[notifType] || notifType || '',
                status: taskResource?.status,
                priority: null,
                due_date: null,
                list: taskResource?.location?.subcategory,
                folder: taskResource?.location?.category,
                space: taskResource?.location?.project,
                unread: bundle.unreadCount > 0,
                unread_count: bundle.unreadCount || 0,
                seen: bundle.status === 'cleared',
                date: bundle.previewNotification?.historyItem?.occurredAt,
                date_updated: bundle.previewNotification?.historyItem?.occurredAt,
                type: notifType,
                action_by: bundle.previewNotification?.historyItem?.actorId,
                url: taskResource?.id ? `https://app.clickup.com/t/${taskResource.id}` : null,
                raw: { bundle, taskResource }
              });
            }
          }

          // Get cursor from pagination object
          cursor = data.pagination?.nextCursor || data.nextCursor;
          pageCount++;
          console.log('[Swipe] Page', pageCount, 'fetched', allNotifications.length, 'total notifications. Next cursor:', cursor ? 'yes' : 'no');
        } while (cursor && pageCount < maxPages);

        return { success: true, notifications: allNotifications, count: allNotifications.length };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    args: [workspaceId, jwtToken]
  });

  return results[0]?.result;
}

/**
 * Get workspace ID from token or find active ClickUp tab
 */
async function getWorkspaceId() {
  const { tokenInfo } = await getAuthToken();
  if (tokenInfo?.workspaceKey) {
    return tokenInfo.workspaceKey;
  }
  return null;
}

/**
 * Find a ClickUp tab to execute the inbox fetch
 */
async function findClickUpTab() {
  const tabs = await chrome.tabs.query({ url: 'https://app.clickup.com/*' });
  return tabs[0];
}

/**
 * Clear a notification bundle via the frontdoor API
 */
async function clearBundleFromTab(tabId, workspaceId, bundleId) {
  // Get JWT token
  const { token: jwtToken } = await getAuthToken();

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (wsId, bId, jwt) => {
      try {
        // URL-encode the bundle ID and use PUT method
        const encodedBundleId = encodeURIComponent(bId);
        const url = `https://frontdoor-prod-us-west-2-2.clickup.com/inbox/v3/workspaces/${wsId}/notifications/bundles/${encodedBundleId}/clear`;

        console.log('[Swipe] Clearing with PUT:', bId.substring(0, 50));

        const response = await fetch(url, {
          method: 'PUT',  // ClickUp uses PUT, not POST!
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Authorization': `Bearer ${jwt}`,
            'x-csrf': '1',
            'x-workspace-id': wsId,
          },
          credentials: 'include',
          body: '{}'
        });

        console.log('[Swipe] Clear response:', response.status);

        if (!response.ok) {
          const text = await response.text();
          return { success: false, status: response.status, error: text };
        }

        return { success: true, status: response.status };
      } catch (error) {
        console.error('[Swipe] Clear failed:', error);
        return { success: false, error: error.message };
      }
    },
    args: [workspaceId, bundleId, jwtToken]
  });

  return results[0]?.result;
}

// External message handlers (from web pages like localhost)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('[Swipe] External message from:', sender.origin, message?.type);

  if (message?.type === 'CLEAR_BUNDLE') {
    (async () => {
      try {
        const tab = await findClickUpTab();
        if (!tab) {
          sendResponse({ success: false, error: 'No ClickUp tab found. Keep ClickUp open while using Swipe.' });
          return;
        }

        const workspaceId = message.workspaceId || '9011099466';
        const result = await clearBundleFromTab(tab.id, workspaceId, message.bundleId);
        sendResponse(result);
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  sendResponse({ error: 'Unknown message type' });
  return true;
});

// Message handlers
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_TOKEN') {
    getAuthToken()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ error: error?.message || 'Unknown error' }));
    return true;
  }

  if (message?.type === 'FETCH_INBOX') {
    (async () => {
      try {
        // Find a ClickUp tab
        const tab = await findClickUpTab();
        console.log('[Swipe] Found tab:', tab?.url);
        if (!tab) {
          sendResponse({
            success: false,
            error: 'No ClickUp tab found. Please open app.clickup.com first.'
          });
          return;
        }

        // Get workspace ID
        const workspaceId = message.workspaceId || await getWorkspaceId();
        if (!workspaceId) {
          sendResponse({
            success: false,
            error: 'Could not determine workspace ID. Please log into ClickUp.'
          });
          return;
        }

        // Get the JWT token
        const { token: jwtToken } = await getAuthToken();

        // Fetch inbox from the ClickUp tab context
        const result = await fetchInboxFromTab(tab.id, workspaceId, jwtToken);
        sendResponse(result);
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message?.type === 'CLEAR_BUNDLE') {
    (async () => {
      try {
        const tab = await findClickUpTab();
        if (!tab) {
          sendResponse({ success: false, error: 'No ClickUp tab found' });
          return;
        }

        const workspaceId = message.workspaceId || '9011099466';
        const result = await clearBundleFromTab(tab.id, workspaceId, message.bundleId);
        sendResponse(result);
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message?.type === 'SEND_TO_SWIPE') {
    (async () => {
      try {
        const response = await fetch(`${SWIPE_URL}/api/inbox-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notifications: message.notifications })
        });

        if (!response.ok) {
          throw new Error(`Swipe server error: ${response.status}`);
        }

        sendResponse({ success: true });
      } catch (error) {
        // If direct POST fails, try opening Swipe with data in URL hash
        sendResponse({
          success: false,
          error: error.message,
          fallback: true
        });
      }
    })();
    return true;
  }
});
