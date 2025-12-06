/**
 * ClickUp API Configuration
 * 
 * SETUP:
 * 1. Copy this file to config.js: cp API/config.example.js API/config.js
 * 2. Replace the token below with your cu_jwt token
 * 
 * To get your token:
 * 1. Log into ClickUp in your browser
 * 2. Open Developer Tools (F12 or Cmd+Option+I)
 * 3. Go to Application → Cookies → app.clickup.com
 * 4. Find the cookie named "cu_jwt"
 * 5. Copy its value and paste it below
 * 
 * The token typically expires after ~48 hours.
 */

// ============================================================
// PASTE YOUR cu_jwt TOKEN HERE (between the quotes)
// ============================================================

const CLICKUP_TOKEN = "YOUR_CU_JWT_TOKEN_HERE";

// ============================================================
// DO NOT EDIT BELOW THIS LINE
// ============================================================

// Helper to check token expiration
function getTokenInfo() {
  try {
    const parts = CLICKUP_TOKEN.split('.');
    if (parts.length !== 3) return { valid: false, error: 'Invalid token format' };
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const expDate = payload.exp ? new Date(payload.exp * 1000) : null;
    const now = new Date();
    
    return {
      valid: true,
      userId: payload.user,
      workspaceKey: payload.ws_key,
      issuedAt: payload.iat ? new Date(payload.iat * 1000) : null,
      expiresAt: expDate,
      isExpired: expDate ? now > expDate : false,
      hoursUntilExpiry: expDate ? Math.round((expDate - now) / (1000 * 60 * 60)) : null,
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CLICKUP_TOKEN, getTokenInfo };
}

export { CLICKUP_TOKEN, getTokenInfo };
export default CLICKUP_TOKEN;
