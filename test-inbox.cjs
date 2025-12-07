const axios = require("axios");
const { CLICKUP_TOKEN } = require("./API/config.js");

async function testInternalAPI() {
  const headers = {
    "Authorization": "Bearer " + CLICKUP_TOKEN,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Origin": "https://app.clickup.com",
    "Referer": "https://app.clickup.com/",
  };

  const endpoints = [
    "https://app.clickup.com/api/v1/inbox",
    "https://app.clickup.com/v1/inbox",
    "https://api.clickup.com/api/v1/inbox",
  ];

  for (const url of endpoints) {
    try {
      const response = await axios.get(url, {
        headers,
        params: { page: 0 },
        timeout: 10000
      });

      const data = response.data;
      console.log("✅", url);

      if (typeof data === "object") {
        console.log("   Keys:", Object.keys(data).slice(0, 5));
        const items = data.notifications || data.inbox || (Array.isArray(data) ? data : []);
        console.log("   Items:", items.length);
        if (items.length > 0 && typeof items[0] === "object") {
          console.log("   First item keys:", Object.keys(items[0]));
        }
      } else if (typeof data === "string" && data[0] !== "<") {
        console.log("   Data (first 200):", data.substring(0, 200));
      } else {
        console.log("   Got HTML response");
      }
    } catch (error) {
      console.log("❌", url, ":", error.response?.status || error.code);
    }
  }
}

testInternalAPI();
