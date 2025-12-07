// ========================================
// State
// ========================================
let notifications = [];
let workspaceId = null;
let currentCardIndex = 0;

// ========================================
// DOM Elements
// ========================================
const statusEl = document.getElementById('status');
const countBadgeEl = document.getElementById('count-badge');
const cardViewEl = document.getElementById('card-view');
const cardStackEl = document.getElementById('card-stack');
const emptyStateEl = document.getElementById('empty-state');
const loadingStateEl = document.getElementById('loading-state');
const debugPanelEl = document.getElementById('debug-panel');
const debugLogEl = document.getElementById('debug-log');
const refreshBtn = document.getElementById('refresh-btn');
const debugBtn = document.getElementById('debug-btn');
const closeDebugBtn = document.getElementById('close-debug');
const skipBtn = document.getElementById('skip-btn');
const clearBtn = document.getElementById('clear-btn');

// ========================================
// Debug Logging
// ========================================
function log(message, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">${time}</span><span class="log-${type}">${message}</span>`;
  debugLogEl.appendChild(entry);
  debugLogEl.scrollTop = debugLogEl.scrollHeight;
  console.log(`[Swipe] ${message}`);
}

// ========================================
// UI State Management
// ========================================
function showLoading() {
  statusEl.classList.add('hidden');
  cardViewEl.classList.add('hidden');
  emptyStateEl.classList.add('hidden');
  loadingStateEl.classList.remove('hidden');
}

function showCards() {
  statusEl.classList.add('hidden');
  loadingStateEl.classList.add('hidden');
  emptyStateEl.classList.add('hidden');
  cardViewEl.classList.remove('hidden');
}

function showEmpty() {
  statusEl.classList.add('hidden');
  loadingStateEl.classList.add('hidden');
  cardViewEl.classList.add('hidden');
  emptyStateEl.classList.remove('hidden');
  countBadgeEl.classList.add('hidden');
}

function showStatus(text, type = '') {
  loadingStateEl.classList.add('hidden');
  cardViewEl.classList.add('hidden');
  emptyStateEl.classList.add('hidden');
  statusEl.classList.remove('hidden', 'error', 'success');
  if (type) statusEl.classList.add(type);
  statusEl.textContent = text;
}

function updateCount() {
  const remaining = notifications.length - currentCardIndex;
  if (remaining > 0) {
    countBadgeEl.textContent = remaining;
    countBadgeEl.classList.remove('hidden');
  } else {
    countBadgeEl.classList.add('hidden');
  }
}

// ========================================
// Card Rendering
// ========================================
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = typeof timestamp === 'string' && timestamp.includes('T')
    ? new Date(timestamp)
    : new Date(parseInt(timestamp));
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getTypeLabel(type) {
  const labels = {
    'assignee_add': 'Assigned',
    'due_date_missed': 'Due Date',
    'comment': 'Comment',
    'task_created': 'Created',
    'status_change': 'Status',
    'messages': 'Message'
  };
  return labels[type] || type || 'Notification';
}

function createCardElement(notification, index) {
  const card = document.createElement('div');
  card.className = 'swipe-card';
  card.dataset.index = index;
  card.dataset.id = notification.id;
  card.dataset.bundleId = notification.bundle_id || notification.id;

  const title = notification.name || 'Untitled Task';
  const description = notification.description || '';
  const type = getTypeLabel(notification.type);
  const timeAgo = formatDate(notification.date || notification.date_updated);
  const space = notification.space || '';
  const list = notification.list || '';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">${escapeHtml(title)}</div>
      <span class="card-type">${escapeHtml(type)}</span>
    </div>
    <div class="card-description">${escapeHtml(description)}</div>
    <div class="card-meta">
      ${timeAgo ? `<span class="card-meta-item">${timeAgo}</span>` : ''}
      ${space ? `<span class="card-meta-item"><span class="dot"></span>${escapeHtml(space)}</span>` : ''}
      ${list ? `<span class="card-meta-item">${escapeHtml(list)}</span>` : ''}
    </div>
  `;

  return card;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderCards() {
  cardStackEl.innerHTML = '';
  const remaining = notifications.slice(currentCardIndex);

  if (remaining.length === 0) {
    showEmpty();
    return;
  }

  // Render top 3 cards (for stacking effect)
  const cardsToRender = remaining.slice(0, 3);
  cardsToRender.forEach((notification, i) => {
    const card = createCardElement(notification, currentCardIndex + i);
    cardStackEl.appendChild(card);
  });

  showCards();
  updateCount();

  // Set up drag on the top card
  const topCard = cardStackEl.firstElementChild;
  if (topCard) {
    setupDrag(topCard);
  }
}

// ========================================
// Swipe / Drag Handling
// ========================================
function setupDrag(card) {
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  const onStart = (e) => {
    isDragging = true;
    startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
    card.classList.add('dragging');
  };

  const onMove = (e) => {
    if (!isDragging) return;
    currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
    const deltaX = currentX - startX;
    const rotation = deltaX * 0.1;
    card.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    card.classList.remove('dragging');

    const deltaX = currentX - startX;
    const threshold = 80;

    if (deltaX > threshold) {
      // Swiped right - Clear
      handleSwipe('right');
    } else if (deltaX < -threshold) {
      // Swiped left - Skip
      handleSwipe('left');
    } else {
      // Snap back
      card.style.transform = '';
    }
  };

  card.addEventListener('mousedown', onStart);
  card.addEventListener('touchstart', onStart);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
}

async function handleSwipe(direction) {
  const card = cardStackEl.firstElementChild;
  if (!card) return;

  const notification = notifications[currentCardIndex];
  const bundleId = notification.bundle_id || notification.id;

  log(`Swiping ${direction}: ${notification.name?.substring(0, 30)}...`, 'info');

  // Animate card off screen
  card.classList.add(direction === 'right' ? 'swiping-right' : 'swiping-left');

  // If swiping right, clear the notification in ClickUp
  if (direction === 'right') {
    await clearBundle(bundleId);
  }

  // Wait for animation
  await new Promise(resolve => setTimeout(resolve, 300));

  // Move to next card
  currentCardIndex++;
  renderCards();
}

// ========================================
// ClickUp API - Clear Bundle
// ========================================
async function clearBundle(bundleId) {
  log(`Clearing bundle: ${bundleId.substring(0, 40)}...`, 'info');

  try {
    // Find ClickUp tab
    const tabs = await chrome.tabs.query({ url: 'https://app.clickup.com/*' });
    if (tabs.length === 0) {
      log('ERROR: No ClickUp tab found! Keep ClickUp open.', 'error');
      return { success: false, error: 'No ClickUp tab' };
    }

    const tabId = tabs[0].id;

    // Get JWT token from cookie
    const cookie = await chrome.cookies.get({
      url: 'https://app.clickup.com',
      name: 'cu_jwt'
    });

    if (!cookie) {
      log('ERROR: cu_jwt cookie not found', 'error');
      return { success: false, error: 'Not logged in' };
    }

    const jwtToken = cookie.value;

    // Execute clear in the tab context - use PUT method with URL-encoded bundle ID
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (wsId, bId, jwt) => {
        try {
          // URL-encode the bundle ID (# becomes %23, etc.)
          const encodedBundleId = encodeURIComponent(bId);
          const url = `https://frontdoor-prod-us-west-2-2.clickup.com/inbox/v3/workspaces/${wsId}/notifications/bundles/${encodedBundleId}/clear`;

          console.log('[Swipe] Clearing with PUT:', url.substring(0, 120) + '...');

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

          if (response.ok) {
            return { success: true, status: response.status };
          }

          const text = await response.text();
          console.log('[Swipe] Clear error:', text.substring(0, 200));
          return { success: false, status: response.status, error: text.substring(0, 150) };
        } catch (error) {
          console.error('[Swipe] Clear failed:', error);
          return { success: false, error: error.message };
        }
      },
      args: [workspaceId, bundleId, jwtToken]
    });

    const result = results[0]?.result;
    if (result?.success) {
      log(`Cleared! Status: ${result.status}`, 'success');
    } else {
      log(`Clear failed: ${result?.error || 'Unknown error'}`, 'error');
    }
    return result;

  } catch (error) {
    log(`Clear error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

// ========================================
// Fetch Inbox
// ========================================
async function fetchInbox() {
  showLoading();
  log('Fetching inbox...', 'info');

  try {
    // Find ClickUp tab
    const tabs = await chrome.tabs.query({ url: 'https://app.clickup.com/*' });
    if (tabs.length === 0) {
      showStatus('Open ClickUp first, then refresh', 'error');
      log('ERROR: No ClickUp tab found', 'error');
      return;
    }

    const tab = tabs[0];
    log(`Using tab: ${tab.url.substring(0, 50)}...`, 'info');

    // Get workspace ID from URL
    const urlMatch = tab.url.match(/\/(\d+)\//);
    workspaceId = urlMatch ? urlMatch[1] : '9011099466';
    log(`Workspace ID: ${workspaceId}`, 'info');

    // Get JWT token from cookie
    const cookie = await chrome.cookies.get({
      url: 'https://app.clickup.com',
      name: 'cu_jwt'
    });

    if (!cookie) {
      showStatus('Not logged into ClickUp', 'error');
      log('ERROR: cu_jwt cookie not found', 'error');
      return;
    }

    const jwtToken = cookie.value;
    log('Got JWT token', 'success');

    // Fetch inbox from tab context
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: async (wsId, jwt) => {
        const allNotifications = [];
        let cursor = null;
        let pageCount = 0;
        const maxPages = 10;

        try {
          do {
            // Match ClickUp's request format - fetch ALL uncleared notifications
            const body = {
              filteredBy: {
                status: 'uncleared',
                saved: false,
                assignedToMe: false,
                mentioned: false,
                unread: false,
                reminders: false
              },
              pagination: {
                nextCursor: cursor || '',
                limit: 50  // Increased from 20
              },
              sortedBy: { direction: 'descending' },
              needsMemberMap: false
            };

            const url = `https://frontdoor-prod-us-west-2-2.clickup.com/inbox/v3/workspaces/${wsId}/notifications/bundles/search`;
            const sessionId = Math.random().toString(36).substring(2, 12);

            console.log('[Swipe] Fetching page', pageCount + 1, cursor ? '(with cursor)' : '(initial)');

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'Authorization': `Bearer ${jwt}`,
                'x-csrf': '1',
                'x-workspace-id': wsId,
                'sessionid': sessionId
              },
              credentials: 'include',
              body: JSON.stringify(body)
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.log('[Swipe] Error response:', errorText.substring(0, 200));
              throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            }

            const text = await response.text();
            if (text.trim().startsWith('<')) {
              throw new Error('Got HTML instead of JSON - session expired?');
            }

            const data = JSON.parse(text);
            // Debug: log what pagination fields exist
            console.log('[Swipe] Response pagination:', JSON.stringify(data.pagination || {}), 'nextCursor at root:', !!data.nextCursor);

            const groups = data.notificationBundleGroups || [];
            const resources = data.resources || [];

            for (const group of groups) {
              const bundles = group.notificationBundles || [];
              for (const bundle of bundles) {
                const taskResource = resources.find(r =>
                  r.entityResourceName === bundle.rootEntityResourceName && r.type === 'task'
                );

                let commentText = '';
                if (bundle.mostRecentCommentNotification?.commentPreview) {
                  commentText = bundle.mostRecentCommentNotification.commentPreview
                    .map(c => c.text || '')
                    .join('')
                    .trim();
                }

                const notifType = bundle.previewNotification?.type || bundle.bundleType || '';

                // Extract string values from location objects
                const spaceName = taskResource?.location?.project?.name || taskResource?.location?.project || '';
                const listName = taskResource?.location?.subcategory?.name || taskResource?.location?.subcategory || '';
                const folderName = taskResource?.location?.category?.name || taskResource?.location?.category || '';

                allNotifications.push({
                  id: bundle.id,
                  bundle_id: bundle.id,
                  task_id: taskResource?.id || bundle.rootEntityResourceName?.split(':').pop(),
                  name: taskResource?.name || 'Unknown Task',
                  description: commentText || '',
                  status: taskResource?.status,
                  list: typeof listName === 'string' ? listName : '',
                  folder: typeof folderName === 'string' ? folderName : '',
                  space: typeof spaceName === 'string' ? spaceName : '',
                  unread: bundle.unreadCount > 0,
                  date: bundle.previewNotification?.historyItem?.occurredAt || bundle.mostRecentNotificationTime,
                  type: notifType,
                  url: taskResource?.id ? `https://app.clickup.com/t/${taskResource.id}` : null
                });
              }
            }

            // Check for cursor in multiple locations (API may return it at top level or nested)
            cursor = data.pagination?.nextCursor || data.nextCursor || null;
            pageCount++;
            console.log('[Swipe] Page', pageCount, '- groups:', groups.length, ', total:', allNotifications.length, ', hasMore:', cursor ? 'yes' : 'no');
          } while (cursor && pageCount < maxPages);

          console.log('[Swipe] Pagination complete:', pageCount, 'pages,', allNotifications.length, 'total notifications');

          return { success: true, notifications: allNotifications, count: allNotifications.length };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      args: [workspaceId, jwtToken]
    });

    const result = results[0]?.result;

    if (!result?.success) {
      showStatus(result?.error || 'Failed to fetch inbox', 'error');
      log(`Fetch failed: ${result?.error}`, 'error');
      return;
    }

    notifications = result.notifications;
    currentCardIndex = 0;
    log(`Loaded ${notifications.length} notifications`, 'success');
    renderCards();

  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    log(`Fetch error: ${error.message}`, 'error');
  }
}

// ========================================
// Event Listeners
// ========================================
refreshBtn.addEventListener('click', fetchInbox);

debugBtn.addEventListener('click', () => {
  debugPanelEl.classList.remove('hidden');
});

closeDebugBtn.addEventListener('click', () => {
  debugPanelEl.classList.add('hidden');
});

skipBtn.addEventListener('click', () => handleSwipe('left'));
clearBtn.addEventListener('click', () => handleSwipe('right'));

// ========================================
// Initial Load
// ========================================
log('Swipe extension loaded', 'info');
fetchInbox();
