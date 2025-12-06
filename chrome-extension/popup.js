const statusEl = document.getElementById('status');
const tokenEl = document.getElementById('token-value');
const tokenInfoEl = document.getElementById('token-info');
const refreshBtn = document.getElementById('refresh');
const copyTokenBtn = document.getElementById('copy-token');

refreshBtn.addEventListener('click', loadToken);
copyTokenBtn.addEventListener('click', () => copyText(tokenEl.value));

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', Boolean(isError));
}

function copyText(text) {
  if (!text) {
    setStatus('Nothing to copy yet.', true);
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => setStatus('✓ Token copied to clipboard!'))
    .catch(() => setStatus('Clipboard blocked by browser.', true));
}

function renderToken(data) {
  const { token, tokenInfo, error } = data || {};

  if (error) {
    setStatus(error, true);
    tokenEl.value = '';
    tokenInfoEl.innerHTML = '<p class="error">Not logged in or token not found.</p>';
    return;
  }

  tokenEl.value = token;

  // Show token info
  if (tokenInfo) {
    const expiryClass = tokenInfo.isExpired ? 'error' : 
                        (tokenInfo.hoursUntilExpiry < 6 ? 'warning' : 'success');
    
    const expiryText = tokenInfo.isExpired ? '❌ EXPIRED' :
                       tokenInfo.hoursUntilExpiry <= 0 ? '⚠️ Expires soon!' :
                       `✓ Valid for ~${tokenInfo.hoursUntilExpiry} hours`;

    tokenInfoEl.innerHTML = `
      <div class="info-row">
        <span class="label">User ID:</span>
        <span class="value">${tokenInfo.userId}</span>
      </div>
      <div class="info-row">
        <span class="label">Expires:</span>
        <span class="value ${expiryClass}">${tokenInfo.expiresAt?.toLocaleString() || 'Unknown'}</span>
      </div>
      <div class="info-row">
        <span class="label">Status:</span>
        <span class="value ${expiryClass}">${expiryText}</span>
      </div>
    `;

    if (tokenInfo.isExpired) {
      setStatus('Token expired! Log into ClickUp to refresh.', true);
    } else {
      setStatus('Token ready to copy.');
    }
  } else {
    tokenInfoEl.innerHTML = '<p>Token found but could not parse details.</p>';
    setStatus('Token found.');
  }
}

function loadToken() {
  setStatus('Reading token…');
  chrome.runtime.sendMessage({ type: 'GET_TOKEN' }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, true);
      return;
    }
    renderToken(response);
  });
}

// Initial load on open.
loadToken();

