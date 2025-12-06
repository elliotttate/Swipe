/**
 * ClickUp API Client - Basic Usage Examples
 * 
 * Run with: node API/examples/basic-usage.cjs
 * 
 * Set your token via environment variable:
 *   export CLICKUP_TOKEN="your_token_here"
 */

const { ClickUpClient } = require('../clickup-client.js');

// Get token from environment or use a placeholder
const TOKEN = process.env.CLICKUP_TOKEN || 'YOUR_TOKEN_HERE';

async function main() {
  if (TOKEN === 'YOUR_TOKEN_HERE') {
    console.error('Please set CLICKUP_TOKEN environment variable');
    console.error('  export CLICKUP_TOKEN="your_token_here"');
    process.exit(1);
  }

  const client = new ClickUpClient({ token: TOKEN });

  try {
    // Get current user
    console.log('=== Current User ===');
    const user = await client.getUser();
    console.log(`Logged in as: ${user.username} (${user.email})`);
    console.log(`User ID: ${user.id}`);
    console.log();

    // Get workspaces
    console.log('=== Workspaces ===');
    const teams = await client.getTeams();
    teams.forEach(team => {
      console.log(`- ${team.name} (ID: ${team.id})`);
    });
    console.log();

    // Get tasks assigned to current user
    console.log('=== My Tasks (first 5) ===');
    const myTasks = await client.getMyTasks();
    myTasks.slice(0, 5).forEach(task => {
      const status = task.status?.status || 'unknown';
      const priority = task.priority?.priority || 'none';
      console.log(`- [${status}] ${task.name}`);
      console.log(`  Priority: ${priority}, ID: ${task.id}`);
      if (task.due_date) {
        console.log(`  Due: ${new Date(parseInt(task.due_date)).toLocaleDateString()}`);
      }
    });
    console.log();

    // Get workspace hierarchy for the first team
    if (teams.length > 0) {
      console.log(`=== Workspace Hierarchy (${teams[0].name}) ===`);
      const hierarchy = await client.getWorkspaceHierarchy(teams[0].id);
      
      hierarchy.forEach(space => {
        console.log(`Space: ${space.name}`);
        
        space.folders.forEach(folder => {
          console.log(`  Folder: ${folder.name}`);
          folder.lists.forEach(list => {
            console.log(`    List: ${list.name}`);
          });
        });
        
        space.lists.forEach(list => {
          console.log(`  List (no folder): ${list.name}`);
        });
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

main();
