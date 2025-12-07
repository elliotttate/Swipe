import React, { useState, useEffect } from 'react';
import CardStack from './components/CardStack';
import AuthModal from './components/AuthModal';
import { getInboxNotifications, markNotificationRead, markNotificationUnread } from './services/clickup';
import { Loader2, LogOut, Inbox } from 'lucide-react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('clickup_token'));
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extensionId, setExtensionId] = useState(null);
  const [workspaceId, setWorkspaceId] = useState(null);

  // Handle OAuth callback and extension sync - check URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get('token');
    const oauthError = urlParams.get('error');
    const syncFromExtension = urlParams.get('sync');

    if (oauthToken) {
      // Save OAuth token and clear URL
      localStorage.setItem('clickup_token', oauthToken);
      setToken(oauthToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthError) {
      setError(`OAuth failed: ${oauthError}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (syncFromExtension) {
      // Fetch synced data from backend
      fetchSyncedData();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchSyncedData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3001/api/inbox-sync');
      if (!response.ok) {
        throw new Error('No synced data available');
      }
      const data = await response.json();
      console.log('Loaded synced data:', data.count, 'items, extensionId:', data.extensionId);
      setNotifications(data.notifications || []);
      setExtensionId(data.extensionId);
      setWorkspaceId(data.workspaceId);
      // Set a marker that we're using synced data
      setToken('synced');
    } catch (err) {
      console.error('Failed to load synced data:', err);
      setError('No synced data. Use the Chrome extension to sync your inbox.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Don't fetch if using synced data from extension
    if (token && token !== 'synced') {
      fetchNotifications();
    }
  }, [token]);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInboxNotifications(token);
      console.log('Fetched tasks:', data);
      // Ensure data is always an array
      const tasks = Array.isArray(data) ? data : [];
      console.log(`Total tasks assigned to you: ${tasks.length}`);
      setNotifications(tasks);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch tasks.');
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('clickup_token');
    setToken(null);
    setNotifications([]);
  };

  const handleSaveToken = (newToken) => {
    localStorage.setItem('clickup_token', newToken);
    setToken(newToken);
  };

  const handleSwipe = async (id, markAsRead) => {
    // Find the notification to get bundle_id
    const notification = notifications.find(n => n.id === id);
    const bundleId = notification?.bundle_id || notification?.id || id;

    // Optimistically remove from UI
    setNotifications(prev => prev.filter(n => n.id !== id));

    if (token === 'synced') {
      // Using synced data - communicate with Chrome extension to clear in ClickUp
      if (markAsRead && extensionId) {
        try {
          // Send message to extension to clear the bundle
          const result = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              extensionId,
              {
                type: 'CLEAR_BUNDLE',
                bundleId: bundleId,
                workspaceId: workspaceId || '9011099466'
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error('Extension error:', chrome.runtime.lastError.message);
                  resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  resolve(response);
                }
              }
            );
          });
          console.log('Clear bundle result:', result);
        } catch (err) {
          console.error('Failed to clear notification via extension:', err);
        }
      } else if (markAsRead && !extensionId) {
        console.warn('No extension ID available - cannot clear in ClickUp');
      }
      // Swipe left = just remove from local view, don't sync to ClickUp
    } else if (token) {
      // Using API token
      if (markAsRead) {
        await markNotificationRead(token, id);
      } else {
        await markNotificationUnread(token, id);
      }
    }
  };

  return (
    <div className="relative w-full h-screen min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Ambient Background */}
      <div className="ambient-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-8 flex justify-between items-center z-50">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white">Swipe</h1>
            {token && notifications.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/80 text-white text-sm font-bold">
                {notifications.length}
              </span>
            )}
          </div>
          <p className="text-white/40 text-sm tracking-widest uppercase">
            {token === 'synced' ? 'Synced Inbox' : token?.startsWith('pk_') ? 'My Tasks' : 'Inbox'}
          </p>
        </div>
        {token && (
          <button
            onClick={handleLogout}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-white/60 hover:text-white transition-all hover:scale-105"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="w-full flex-1 flex flex-col items-center justify-center relative z-10">
        {!token ? (
          <AuthModal onSave={handleSaveToken} />
        ) : loading && notifications.length === 0 ? (
          <div className="flex flex-col items-center text-white/50">
            <Loader2 className="animate-spin mb-4 text-white" size={48} />
            <p className="text-lg font-light tracking-wide">Syncing with ClickUp...</p>
          </div>
        ) : error ? (
          <div className="text-center p-8 glass-panel border-red-500/30 max-w-md mx-4">
            <p className="text-red-400 mb-6 text-lg">{error}</p>
            <button onClick={fetchNotifications} className="btn-primary w-full">Try Again</button>
          </div>
        ) : (
          <CardStack
            notifications={notifications}
            onSwipe={handleSwipe}
            onRefresh={fetchNotifications}
          />
        )}
      </main>
    </div>
  );
}

export default App;
