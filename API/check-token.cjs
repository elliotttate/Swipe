#!/usr/bin/env node
/**
 * Quick Token Check
 * 
 * Run: node API/check-token.cjs
 * 
 * This will show you:
 * - If your token is valid
 * - When it expires
 * - Your user info from ClickUp
 */

const { CLICKUP_TOKEN, getTokenInfo } = require('./config.js');
const { ClickUpClient } = require('./clickup-client.js');

async function checkToken() {
  console.log('🔍 Checking ClickUp Token...\n');
  
  // Check token structure
  const info = getTokenInfo();
  
  if (!info.valid) {
    console.log('❌ Invalid token format:', info.error);
    console.log('\n👉 Update your token in API/config.js');
    return;
  }
  
  console.log('Token Info:');
  console.log(`  User ID: ${info.userId}`);
  console.log(`  Workspace Key: ${info.workspaceKey}`);
  console.log(`  Issued: ${info.issuedAt?.toLocaleString() || 'Unknown'}`);
  console.log(`  Expires: ${info.expiresAt?.toLocaleString() || 'Unknown'}`);
  
  if (info.isExpired) {
    console.log('\n❌ TOKEN EXPIRED!');
    console.log('👉 Update your token in API/config.js');
    return;
  }
  
  if (info.hoursUntilExpiry !== null) {
    if (info.hoursUntilExpiry <= 0) {
      console.log(`\n⚠️  Token expires in less than an hour!`);
    } else if (info.hoursUntilExpiry < 6) {
      console.log(`\n⚠️  Token expires in ~${info.hoursUntilExpiry} hours`);
    } else {
      console.log(`\n✅ Token valid for ~${info.hoursUntilExpiry} hours`);
    }
  }
  
  // Test API connection
  console.log('\n🔗 Testing API connection...');
  
  try {
    const client = new ClickUpClient({ token: CLICKUP_TOKEN });
    const user = await client.getUser();
    
    console.log('\n✅ API Connection Successful!');
    console.log(`  Logged in as: ${user.username}`);
    console.log(`  Email: ${user.email}`);
    
    const teams = await client.getTeams();
    console.log(`  Workspaces: ${teams.length}`);
    teams.forEach(t => console.log(`    - ${t.name}`));
    
  } catch (error) {
    console.log('\n❌ API Connection Failed!');
    console.log(`  Error: ${error.message}`);
    
    if (error.status === 401) {
      console.log('\n👉 Your token may have expired. Update it in API/config.js');
    }
  }
}

checkToken();
