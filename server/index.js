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
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`\n🚀 OAuth Server running on http://localhost:${PORT}`);
  console.log(`\n📋 Setup Instructions:`);
  console.log(`   1. Go to https://app.clickup.com/settings/integrations`);
  console.log(`   2. Click "Create an App"`);
  console.log(`   3. Set Redirect URL to: ${REDIRECT_URI}`);
  console.log(`   4. Copy Client ID and Secret to .env file`);
  console.log(`\n🔗 OAuth URL: http://localhost:${PORT}/auth/clickup\n`);
});

