import axios from 'axios';

// Use backend proxy for OAuth endpoints, direct API for personal tokens
const API_URL = 'https://api.clickup.com/api/v2';
const PRIVATE_API_URL = 'https://app.clickup.com/api/v1';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Check if token is a JWT session token (cu_jwt)
 */
const isSessionToken = (token) => {
  try {
    if (token && token.split('.').length === 3) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.session_token === true || payload.ws_key !== undefined;
    }
  } catch (e) {
    // Not a JWT
  }
  return false;
};

/**
 * Check if token is OAuth (starts with different prefix) or personal API token
 */
const isOAuthToken = (token) => {
  // OAuth tokens typically don't start with 'pk_'
  return token && !token.startsWith('pk_');
};

/**
 * Fetch inbox items using session JWT token (private API)
 */
const fetchInboxViaSessionToken = async (token) => {
  try {
    console.log('Fetching inbox via session JWT token (private API)...');

    // Fetch all pages of inbox items
    let allNotifications = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await axios.get(`${PRIVATE_API_URL}/inbox`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        params: { page }
      });

      const notifications = response.data.notifications || response.data.inbox || response.data || [];
      console.log(`Page ${page}: got ${Array.isArray(notifications) ? notifications.length : 0} items`);

      if (Array.isArray(notifications) && notifications.length > 0) {
        allNotifications.push(...notifications);
        page++;
        // ClickUp typically returns 100 items per page - if less, we're done
        if (notifications.length < 100) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`Total inbox items fetched: ${allNotifications.length}`);

    // Transform to consistent format
    return allNotifications.map(notification => {
      const task = notification.task || notification;
      return {
        id: notification.id || task.id,
        task_id: task.id,
        name: task.name || notification.hist_value || notification.action_type || 'Notification',
        description: getNotificationDescription(notification, task),
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        assignees: task.assignees,
        list: task.list,
        folder: task.folder,
        space: task.space,
        unread: notification.unread !== false,
        seen: notification.seen,
        date: notification.date,
        date_updated: task.date_updated || notification.date,
        type: notification.type || notification.action_type,
        action_by: notification.user || notification.initiator,
        url: task.url,
        raw: notification
      };
    });
  } catch (error) {
    console.error('Session JWT fetch failed:', error);
    throw error;
  }
};

/**
 * Fetch notifications/tasks via OAuth backend proxy
 */
const fetchViaOAuth = async (token) => {
  try {
    console.log('Fetching via OAuth backend proxy...');
    const response = await axios.get(`${BACKEND_URL}/api/notifications`, {
      headers: { Authorization: token }
    });

    console.log('Backend response:', response.data);
    
    const notifications = response.data.notifications || [];
    const isFallback = response.data.fallback === true;
    
    console.log(`Got ${notifications.length} items (fallback: ${isFallback})`);

    // Transform to consistent format
    return notifications.map(notification => {
      const task = notification.task || notification;
      return {
        id: notification.id || task.id,
        task_id: task.id,
        name: task.name || 'Notification',
        description: getNotificationDescription(notification, task),
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        assignees: task.assignees,
        list: task.list,
        folder: task.folder,
        space: task.space,
        unread: notification.unread !== false,
        seen: notification.seen,
        date: notification.date,
        date_updated: task.date_updated || notification.date,
        type: notification.type,
        action_by: notification.user,
        url: task.url,
        raw: notification
      };
    });
  } catch (error) {
    console.error('OAuth fetch failed:', error);
    throw error;
  }
};

/**
 * Generate a human-readable description
 */
const getNotificationDescription = (notification, task) => {
  const actorName = notification.user?.username || 'Someone';
  
  // If it's a real notification with type
  if (notification.type) {
    switch (notification.type) {
      case 'TASK_ASSIGNED':
        return `${actorName} assigned this task to you`;
      case 'TASK_COMMENT':
        return notification.comment?.text_content || `${actorName} commented`;
      case 'TASK_MENTION':
        return `${actorName} mentioned you`;
      case 'TASK_DUE_DATE':
        return `${actorName} updated the due date`;
      case 'TASK_STATUS_CHANGE':
        return `${actorName} changed the status`;
      default:
        return notification.text || `Activity from ${actorName}`;
    }
  }
  
  // Fallback for tasks (no notification type)
  return task?.description || task?.text_content || '';
};

/**
 * Fetch tasks assigned to user (for personal API tokens)
 */
const fetchTasksPersonalToken = async (token) => {
  try {
    // Get User ID
    const userRes = await axios.get(`${API_URL}/user`, {
      headers: { Authorization: token }
    });
    const user = userRes.data.user;
    console.log('Logged in as:', user.username, '(ID:', user.id, ')');

    // Get All Teams
    const teamRes = await axios.get(`${API_URL}/team`, {
      headers: { Authorization: token }
    });
    const teams = teamRes.data.teams;
    
    if (!teams || teams.length === 0) {
      throw new Error('No workspaces found');
    }

    // Fetch Tasks from ALL Teams
    const tasksPromises = teams.map(async (team) => {
      try {
        const tasksRes = await axios.get(`${API_URL}/team/${team.id}/task`, {
          headers: { Authorization: token },
          params: {
            'assignees[]': user.id,
            subtasks: true,
            include_closed: false,
            order_by: 'updated',
            reverse: true
          }
        });
        
        const tasks = tasksRes.data.tasks || [];
        return tasks.filter(t => t.status?.type !== 'closed' && t.status?.type !== 'done');
      } catch (err) {
        console.warn(`Failed to fetch tasks for workspace ${team.name}:`, err.message);
        return [];
      }
    });

    const results = await Promise.all(tasksPromises);
    const allTasks = results.flat();
    const uniqueTasks = Array.from(new Map(allTasks.map(t => [t.id, t])).values());

    return uniqueTasks.sort((a, b) => {
      return parseInt(b.date_updated || 0) - parseInt(a.date_updated || 0);
    }).map(task => ({
      id: task.id,
      task_id: task.id,
      name: task.name,
      description: task.description || task.text_content || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      assignees: task.assignees,
      list: task.list,
      folder: task.folder,
      space: task.space,
      date_updated: task.date_updated,
      date_created: task.date_created,
      creator: task.creator,
      unread: true,
      url: task.url,
      raw: task
    }));

  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
};

/**
 * Main function to fetch inbox items - uses session JWT, OAuth, or personal token
 */
export const getInboxNotifications = async (token) => {
  if (isSessionToken(token)) {
    console.log('Using session JWT token (private API)');
    return fetchInboxViaSessionToken(token);
  } else if (isOAuthToken(token)) {
    console.log('Using OAuth flow');
    return fetchViaOAuth(token);
  } else {
    console.log('Using personal API token');
    return fetchTasksPersonalToken(token);
  }
};

/**
 * Mark notification/task as read/complete
 */
export const markNotificationRead = async (token, id) => {
  try {
    if (isOAuthToken(token)) {
      // Try notification endpoint first
      try {
        await axios.put(`${BACKEND_URL}/api/notifications/${id}`, 
          { seen: true },
          { headers: { Authorization: token } }
        );
        console.log('Marked notification as read:', id);
        return true;
      } catch (e) {
        // Fall back to marking task complete
        console.log('Notification endpoint failed, trying task...');
      }
    }
    
    // Mark task as complete
    await axios.put(`${API_URL}/task/${id}`, 
      { status: 'complete' },
      { headers: { Authorization: token } }
    );
    console.log('Marked task as complete:', id);
    return true;
  } catch (error) {
    console.error('Error marking as read/complete:', error);
    return false;
  }
};

/**
 * Mark notification as unread / skip (no-op for tasks)
 */
export const markNotificationUnread = async (token, id) => {
  if (isOAuthToken(token)) {
    try {
      await axios.put(`${BACKEND_URL}/api/notifications/${id}`, 
        { seen: false },
        { headers: { Authorization: token } }
      );
      return true;
    } catch (error) {
      // Ignore - might be a task not a notification
    }
  }
  // For tasks, just skip (no-op)
  console.log('Skipped:', id);
  return true;
};

/**
 * Get OAuth login URL
 */
export const getOAuthLoginUrl = () => {
  return `${BACKEND_URL}/auth/clickup`;
};

// Backwards compatibility
export const getAssignedTasks = getInboxNotifications;
