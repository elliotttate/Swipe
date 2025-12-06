const CLICKUP_DOMAINS = [
  'app.clickup.com',
  '.app.clickup.com',
  'clickup.com',
  '.clickup.com'
];

/**
 * Collect cookies for the configured domains and return a header-friendly string.
 */
async function collectCookies() {
  const collected = [];

  for (const domain of CLICKUP_DOMAINS) {
    try {
      const cookies = await chrome.cookies.getAll({ domain });
      collected.push(...cookies);
    } catch (error) {
      // Ignore domains we cannot read (user may not be logged in for all).
      console.warn(`Cookie fetch failed for ${domain}:`, error);
    }
  }

  // Deduplicate by name, preferring the cookie with the latest expiration date.
  const latestByName = {};
  for (const cookie of collected) {
    const existing = latestByName[cookie.name];
    const expires = cookie.expirationDate || 0;
    const existingExpires = existing?.expirationDate || 0;
    if (!existing || expires >= existingExpires) {
      latestByName[cookie.name] = cookie;
    }
  }

  const cookies = Object.values(latestByName).sort((a, b) => {
    const aExp = a.expirationDate || 0;
    const bExp = b.expirationDate || 0;
    return bExp - aExp;
  });

  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  return { cookies, cookieHeader };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_COOKIES') {
    collectCookies()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ error: error?.message || 'Unknown error' }));
    return true; // Keep the message channel open for async response.
  }
});

