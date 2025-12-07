#!/bin/bash
TOKEN=$(node -e "const {CLICKUP_TOKEN}=require('./API/config.js'); console.log(CLICKUP_TOKEN)")

curl -s -X POST 'https://app.clickup.com/inbox/v3/workspaces/9011099466/notifications/bundles/search' \
  -H "Cookie: cu_jwt=$TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' \
  -H 'Origin: https://app.clickup.com' \
  -H 'Referer: https://app.clickup.com/' \
  -d '{}' | head -c 1000
