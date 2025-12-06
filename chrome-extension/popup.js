const statusEl = document.getElementById('status');
const headerEl = document.getElementById('header-value');
const cookieListEl = document.getElementById('cookie-list');
const refreshBtn = document.getElementById('refresh');
const copyHeaderBtn = document.getElementById('copy-header');

refreshBtn.addEventListener('click', loadCookies);
copyHeaderBtn.addEventListener('click', () => copyText(headerEl.value));

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
    .then(() => setStatus('Copied to clipboard.'))
    .catch(() => setStatus('Clipboard blocked by browser.', true));
}

function renderCookies(data) {
  const { cookies = [], cookieHeader = '', error } = data || {};

  if (error) {
    setStatus(error, true);
    return;
  }

  headerEl.value = cookieHeader;
  cookieListEl.innerHTML = '';

  if (!cookies.length) {
    const empty = document.createElement('p');
    empty.className = 'small';
    empty.textContent = 'No ClickUp cookies were found. Make sure you are logged in at https://app.clickup.com and refresh.';
    cookieListEl.appendChild(empty);
    setStatus('No cookies yet.');
    return;
  }

  cookies.forEach((cookie) => {
    const row = document.createElement('div');
    row.className = 'cookie-row';

    const text = document.createElement('div');
    text.className = 'cookie-text';
    text.textContent = `${cookie.name}=${cookie.value}`;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn tertiary';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => copyText(`${cookie.name}=${cookie.value}`));

    row.appendChild(text);
    row.appendChild(copyBtn);
    cookieListEl.appendChild(row);
  });

  setStatus(`Found ${cookies.length} cookies.`);
}

function loadCookies() {
  setStatus('Reading cookies…');
  chrome.runtime.sendMessage({ type: 'GET_COOKIES' }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, true);
      return;
    }
    renderCookies(response);
  });
}

// Initial load on open.
loadCookies();

