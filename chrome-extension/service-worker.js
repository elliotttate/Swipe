const CLICKUP_DOMAIN = 'app.clickup.com';

// The specific cookie we need for API authentication
const TARGET_COOKIE = 'cu_jwt';

/**
 * Get the cu_jwt token from ClickUp cookies.
 * This is the only cookie needed for API authentication.
 */
async function getAuthToken() {
  try {
    // Get the specific cu_jwt cookie
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

    // Parse the JWT to get expiration info
    const tokenInfo = parseJwt(cookie.value);

    return { 
      token: cookie.value,
      tokenInfo,
      error: null
    };
  } catch (error) {
    return { 
      token: null, 
      error: error?.message || 'Failed to read cookies',
      tokenInfo: null
    };
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_TOKEN') {
    getAuthToken()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ error: error?.message || 'Unknown error' }));
    return true; // Keep the message channel open for async response.
  }
});

