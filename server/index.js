import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ClickUp OAuth Configuration
const CLICKUP_CLIENT_ID = process.env.CLICKUP_CLIENT_ID;
const CLICKUP_CLIENT_SECRET = process.env.CLICKUP_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3001/auth/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'chrome-extension://*'],
  credentials: true
}));

// Also allow all origins for the sync endpoint (extension needs this)
app.options('/api/inbox-sync', cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Step 1: Redirect user to ClickUp OAuth
app.get('/auth/clickup', (req, res) => {
  if (!CLICKUP_CLIENT_ID) {
    return res.status(500).json({ error: 'CLICKUP_CLIENT_ID not configured' });
  }
  
  const authUrl = `https://app.clickup.com/api?client_id=${CLICKUP_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  console.log('Redirecting to ClickUp OAuth:', authUrl);
  res.redirect(authUrl);
});

// Step 2: Handle OAuth callback from ClickUp
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    console.error('No code received from ClickUp');
    return res.redirect(`${FRONTEND_URL}?error=no_code`);
  }

  try {
    console.log('Exchanging code for token...');
    
    // Exchange code for access token
    const tokenResponse = await axios.post('https://api.clickup.com/api/v2/oauth/token', {
      client_id: CLICKUP_CLIENT_ID,
      client_secret: CLICKUP_CLIENT_SECRET,
      code: code
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const { access_token } = tokenResponse.data;
    console.log('Successfully obtained access token');

    // Redirect back to frontend with token
    // In production, you'd want to use httpOnly cookies or a more secure method
    res.redirect(`${FRONTEND_URL}?token=${access_token}`);
    
  } catch (error) {
    console.error('OAuth token exchange failed:', error.response?.data || error.message);
    res.redirect(`${FRONTEND_URL}?error=token_exchange_failed`);
  }
});

// Debug endpoint to test what we can access
app.get('/api/debug', async (req, res) => {
  const token = req.headers.authorization;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const results = {};
  
  // Test various endpoints
  const testEndpoints = [
    { name: 'user', url: 'https://api.clickup.com/api/v2/user' },
    { name: 'teams', url: 'https://api.clickup.com/api/v2/team' },
    { name: 'notification_v2', url: 'https://api.clickup.com/api/v2/notification' },
    { name: 'inbox_v1', url: 'https://app.clickup.com/api/v1/inbox' },
    { name: 'inbox_internal', url: 'https://app.clickup.com/inbox/v1' },
    { name: 'notifications_v1', url: 'https://app.clickup.com/api/v1/notifications' },
    { name: 'activity', url: 'https://api.clickup.com/api/v2/team/{team_id}/activity' },
  ];

  for (const ep of testEndpoints) {
    try {
      const response = await axios.get(ep.url, {
        headers: { Authorization: token },
        timeout: 5000
      });
      results[ep.name] = { status: 'OK', data: response.data };
    } catch (error) {
      results[ep.name] = { 
        status: error.response?.status || 'ERROR', 
        error: error.response?.data || error.message 
      };
    }
  }

  res.json(results);
});

// Proxy endpoint for notifications - try internal API
app.get('/api/notifications', async (req, res) => {
  const token = req.headers.authorization;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // First get user to find team IDs
  let userId, teams;
  try {
    const userRes = await axios.get('https://api.clickup.com/api/v2/user', {
      headers: { Authorization: token }
    });
    userId = userRes.data.user.id;
    
    const teamsRes = await axios.get('https://api.clickup.com/api/v2/team', {
      headers: { Authorization: token }
    });
    teams = teamsRes.data.teams;
    console.log('User ID:', userId, 'Teams:', teams.map(t => t.name));
  } catch (error) {
    console.error('Failed to get user/teams:', error.message);
    return res.status(500).json({ error: 'Failed to get user info' });
  }

  // Try multiple potential endpoints including team-specific ones
  const endpoints = [
    'https://app.clickup.com/api/v1/inbox',
    'https://app.clickup.com/v1/inbox', 
    'https://api.clickup.com/api/v1/inbox',
    `https://app.clickup.com/api/v1/user/${userId}/inbox`,
    `https://app.clickup.com/api/v1/user/${userId}/notifications`,
    ...teams.map(t => `https://app.clickup.com/api/v1/team/${t.id}/inbox`),
    ...teams.map(t => `https://api.clickup.com/api/v2/team/${t.id}/notification`),
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying endpoint: ${endpoint}`);
      const response = await axios.get(endpoint, {
        headers: { 
          Authorization: token,
          'Content-Type': 'application/json',
        },
        params: { page: 0 },
        timeout: 5000
      });
      console.log(`✅ Success with endpoint: ${endpoint}`);
      console.log('Response keys:', Object.keys(response.data));
      res.json(response.data);
      return;
    } catch (error) {
      console.log(`❌ Failed ${endpoint}:`, error.response?.status || error.code);
    }
  }

  // If all fail, fall back to fetching assigned tasks
  console.log('All notification endpoints failed, falling back to tasks...');
  try {
    const allTasks = [];
    for (const team of teams) {
      const tasksRes = await axios.get(`https://api.clickup.com/api/v2/team/${team.id}/task`, {
        headers: { Authorization: token },
        params: {
          'assignees[]': userId,
          subtasks: true,
          include_closed: false,
          order_by: 'updated',
          reverse: true
        }
      });
      allTasks.push(...(tasksRes.data.tasks || []));
    }
    
    // Transform to notification-like format
    const notifications = allTasks
      .filter(t => t.status?.type !== 'closed')
      .map(task => ({
        id: task.id,
        task: task,
        unread: true,
        date: task.date_updated
      }));
    
    res.json({ notifications, fallback: true });
  } catch (error) {
    console.error('Fallback also failed:', error.message);
    res.status(500).json({ error: 'All methods failed' });
  }
});

// Proxy endpoint for marking notification as seen
app.put('/api/notifications/:id', async (req, res) => {
  const token = req.headers.authorization;
  const { id } = req.params;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const response = await axios.put(`https://api.clickup.com/api/v2/notification/${id}`, req.body, {
      headers: { 
        Authorization: token,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Notification update failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to update notification' });
  }
});

// Proxy endpoint for inbox using session JWT token (cu_jwt) - v3 API
app.get('/api/inbox', async (req, res) => {
  const token = req.headers.authorization;
  const workspaceId = req.query.workspace_id || '9011099466'; // Default workspace

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Check if it's a JWT session token
  const isJWT = token.split('.').length === 3;

  if (!isJWT) {
    return res.status(400).json({ error: 'This endpoint requires a JWT session token (cu_jwt)' });
  }

  try {
    console.log(`Fetching inbox for workspace ${workspaceId} using v3 API...`);

    // Use the v3 inbox API with cookie authentication
    const searchUrl = `https://app.clickup.com/inbox/v3/workspaces/${workspaceId}/notifications/bundles/search`;

    const response = await axios.post(searchUrl, {
      // Empty body to get all notifications
    }, {
      headers: {
        'Cookie': `cu_jwt=${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://app.clickup.com',
        'Referer': 'https://app.clickup.com/',
      },
      timeout: 30000
    });

    const data = response.data;

    // Check if we got HTML instead of JSON
    if (typeof data === 'string' && data.trim().startsWith('<')) {
      console.log('Got HTML response - token may be invalid or expired');
      return res.status(401).json({ error: 'Invalid or expired JWT token' });
    }

    // v3 API returns { resources: [...], bundles: [...] }
    const resources = data.resources || [];
    const bundles = data.bundles || [];
    console.log(`Got ${resources.length} resources and ${bundles.length} bundles`);

    // Transform to notification format expected by frontend
    const notifications = bundles.map(bundle => {
      // Find matching resource (task info)
      const taskResource = resources.find(r =>
        r.entityResourceName === bundle.entityResourceName && r.type === 'task'
      );

      return {
        id: bundle.id,
        task_id: taskResource?.id || bundle.id,
        name: taskResource?.name || bundle.type || 'Notification',
        description: bundle.commentPreview?.[0]?.text || '',
        status: taskResource?.status,
        priority: null,
        due_date: null,
        list: taskResource?.location?.subcategory,
        folder: taskResource?.location?.category,
        space: taskResource?.location?.project,
        unread: !bundle.read,
        seen: bundle.read,
        date: bundle.createdAt,
        date_updated: bundle.createdAt,
        type: bundle.type,
        action_by: bundle.author,
        url: null,
        raw: { bundle, taskResource }
      };
    });

    res.json({ notifications, resources, bundles, total: bundles.length });
  } catch (error) {
    console.error('Inbox fetch failed:', error.response?.status, error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch inbox',
      details: error.message
    });
  }
});

// Proxy endpoint for user info
app.get('/api/user', async (req, res) => {
  const token = req.headers.authorization;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const response = await axios.get('https://api.clickup.com/api/v2/user', {
      headers: { Authorization: token }
    });
    res.json(response.data);
  } catch (error) {
    console.error('User fetch failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to fetch user' });
  }
});

// In-memory storage for synced inbox data from extension
let syncedInboxData = null;

// Endpoint to receive synced inbox data from Chrome extension
app.post('/api/inbox-sync', (req, res) => {
  const { notifications, token, workspaceId, extensionId } = req.body;

  if (!notifications || !Array.isArray(notifications)) {
    return res.status(400).json({ error: 'Invalid notifications data' });
  }

  syncedInboxData = {
    notifications,
    token,  // Store JWT for write operations
    workspaceId: workspaceId || '9011099466',
    extensionId,  // Store extension ID for frontend-to-extension communication
    timestamp: Date.now(),
    count: notifications.length
  };

  console.log(`Received ${notifications.length} notifications from extension (extensionId: ${extensionId || 'none'})`);
  res.json({ success: true, count: notifications.length });
});

// Endpoint to mark a notification bundle as read/cleared
app.post('/api/inbox-sync/mark-read', async (req, res) => {
  const { bundleIds } = req.body;

  if (!syncedInboxData?.token) {
    return res.status(401).json({ error: 'No sync token available. Please re-sync from the extension.' });
  }

  if (!bundleIds || !Array.isArray(bundleIds) || bundleIds.length === 0) {
    return res.status(400).json({ error: 'bundleIds array required' });
  }

  const { token, workspaceId } = syncedInboxData;

  try {
    console.log(`Marking ${bundleIds.length} bundles as read...`);

    const response = await axios.post(
      `https://frontdoor-prod-us-west-2-2.clickup.com/inbox/v3/workspaces/${workspaceId}/notifications/bundles/read`,
      { bundleIds },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'x-csrf': '1',
          'x-workspace-id': workspaceId,
          'Origin': 'https://app.clickup.com',
          'Referer': `https://app.clickup.com/${workspaceId}/inbox`,
        }
      }
    );

    console.log('Mark read response:', response.status);

    // Remove from local cache
    if (syncedInboxData?.notifications) {
      syncedInboxData.notifications = syncedInboxData.notifications.filter(
        n => !bundleIds.includes(n.id) && !bundleIds.includes(n.bundle_id)
      );
      syncedInboxData.count = syncedInboxData.notifications.length;
    }

    res.json({ success: true, remaining: syncedInboxData?.count || 0 });
  } catch (error) {
    console.error('Mark read failed:', error.response?.status, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to mark as read',
      details: error.response?.data || error.message
    });
  }
});

// Endpoint to clear/archive a notification bundle
app.post('/api/inbox-sync/clear', async (req, res) => {
  const { bundleIds } = req.body;

  if (!syncedInboxData?.token) {
    return res.status(401).json({ error: 'No sync token available. Please re-sync from the extension.' });
  }

  if (!bundleIds || !Array.isArray(bundleIds) || bundleIds.length === 0) {
    return res.status(400).json({ error: 'bundleIds array required' });
  }

  const { token, workspaceId } = syncedInboxData;

  try {
    console.log(`Clearing ${bundleIds.length} bundles...`);

    // Clear each bundle - bundle ID goes in URL path
    // Only encode # to %23, leave = and : as-is
    const results = [];
    for (const bundleId of bundleIds) {
      const encodedBundleId = bundleId.replace(/#/g, '%23');
      const url = `https://frontdoor-prod-us-west-2-2.clickup.com/inbox/v3/workspaces/${workspaceId}/notifications/bundles/${encodedBundleId}/clear`;

      console.log('Clearing bundle:', bundleId.substring(0, 50) + '...');

      try {
        const response = await axios.post(
          url,
          {},  // Empty body
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/plain, */*',
              'x-csrf': '1',
              'x-workspace-id': workspaceId,
              'Origin': 'https://app.clickup.com',
              'Referer': `https://app.clickup.com/${workspaceId}/inbox`,
            }
          }
        );
        results.push({ bundleId, status: response.status, success: true });
        console.log('Clear response:', response.status);
      } catch (err) {
        console.error('Clear single failed:', err.response?.status, err.response?.data || err.message);
        results.push({ bundleId, status: err.response?.status, success: false, error: err.message });
      }
    }

    // Remove successfully cleared from local cache
    const clearedIds = results.filter(r => r.success).map(r => r.bundleId);
    if (syncedInboxData?.notifications && clearedIds.length > 0) {
      syncedInboxData.notifications = syncedInboxData.notifications.filter(
        n => !clearedIds.includes(n.id) && !clearedIds.includes(n.bundle_id)
      );
      syncedInboxData.count = syncedInboxData.notifications.length;
    }

    res.json({ success: true, results, remaining: syncedInboxData?.count || 0 });
  } catch (error) {
    console.error('Clear failed:', error.response?.status, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to clear',
      details: error.response?.data || error.message
    });
  }
});

// Endpoint to get synced inbox data
app.get('/api/inbox-sync', (req, res) => {
  if (!syncedInboxData) {
    return res.status(404).json({ error: 'No synced data available' });
  }

  // Check if data is older than 1 hour
  const age = Date.now() - syncedInboxData.timestamp;
  if (age > 60 * 60 * 1000) {
    return res.status(410).json({ error: 'Synced data expired', age });
  }

  res.json(syncedInboxData);
});

// Clear synced data
app.delete('/api/inbox-sync', (req, res) => {
  syncedInboxData = null;
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`\n🚀 OAuth Server running on http://localhost:${PORT}`);
  console.log(`\n📋 Setup Instructions:`);
  console.log(`   1. Go to https://app.clickup.com/settings/integrations`);
  console.log(`   2. Click "Create an App"`);
  console.log(`   3. Set Redirect URL to: ${REDIRECT_URI}`);
  console.log(`   4. Copy Client ID and Secret to .env file`);
  console.log(`\n🔗 OAuth URL: http://localhost:${PORT}/auth/clickup\n`);
});

