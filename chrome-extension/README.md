# ClickUp Token Helper - Chrome Extension

A simple Chrome extension to grab your ClickUp `cu_jwt` token for API authentication.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

## Usage

1. Make sure you're logged into [ClickUp](https://app.clickup.com)
2. Click the extension icon
3. Click "Copy Token"
4. Paste the token into `API/config.js`

## What it shows

- **API Token**: The `cu_jwt` cookie value you need
- **User ID**: Your ClickUp user ID
- **Expiration**: When the token expires (~48 hours)
- **Status**: Whether the token is still valid

## Token Expiration

Tokens typically expire after ~48 hours. When your token expires:
1. Log into ClickUp in your browser
2. Click the extension to get a fresh token
3. Update `API/config.js` with the new token

# Swipe Session Cookie Helper (Chrome Extension)

Quick, no-build Chrome extension to extract your ClickUp session cookies so you can call the private API directly.

## Install (Unpacked)

1. Make sure you are logged in at https://app.clickup.com in Chrome. Keep a tab open on that domain.
2. In Chrome, go to `chrome://extensions`, turn on **Developer mode**, then click **Load unpacked**.
3. Select the folder `chrome-extension` from this repo.

## Use

1. Click the extension icon. It will read cookies for `app.clickup.com` (and subdomains) via the Chrome cookies API.
2. Copy either:
   - **Cookie header** (already formatted as `name=value; name=value`) for direct API use, or
   - Individual `name=value` entries if you only need one cookie (e.g., `token`, `auth_token`, `sid`).
3. Paste into your private API client (e.g., Postman, curl) as the `Cookie` header.

If nothing shows up, refresh a logged-in tab on `app.clickup.com` and click **Refresh** in the popup.

