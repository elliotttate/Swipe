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

