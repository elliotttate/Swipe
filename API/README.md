# ClickUp API Client

A comprehensive JavaScript/Node.js client for the ClickUp API with support for multiple authentication methods.

## Features

- **Multiple Auth Methods**: Personal API tokens, OAuth tokens, and session JWTs
- **Full API Coverage**: Users, Teams, Spaces, Folders, Lists, Tasks, Comments, Tags, Custom Fields, Webhooks, Goals, and more
- **Helper Methods**: Get all tasks assigned to you, search tasks, get workspace hierarchy
- **Error Handling**: Custom error class with status codes and response details
- **Dual Module Support**: Works with both CommonJS and ES Modules

## Installation

Copy `clickup-client.js` to your project, or import directly:

```javascript
// ES Modules
import { ClickUpClient } from './API/clickup-client.js';

// CommonJS
const { ClickUpClient } = require('./API/clickup-client.js');
```

## Authentication

### Personal API Token

Get your personal token from ClickUp Settings → Apps → API Token

```javascript
const client = new ClickUpClient({ 
  token: 'pk_YOUR_PERSONAL_TOKEN' 
});
```

### OAuth Token

Use an OAuth access token obtained through the OAuth flow:

```javascript
const client = new ClickUpClient({ 
  token: 'OAUTH_ACCESS_TOKEN' 
});
```

### Session JWT (Private API)

Extract the `cu_jwt` cookie from an authenticated browser session:

```javascript
const client = new ClickUpClient({ 
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ...' 
});
```

## Quick Start

```javascript
import { ClickUpClient } from './clickup-client.js';

const client = new ClickUpClient({ token: 'YOUR_TOKEN' });

// Get current user
const user = await client.getUser();
console.log(`Hello, ${user.username}!`);

// Get all workspaces
const teams = await client.getTeams();

// Get tasks assigned to you
const myTasks = await client.getMyTasks();

// Create a task
const newTask = await client.createTask('LIST_ID', 'My new task', {
  description: 'Task description',
  priority: 3,  // 1=Urgent, 2=High, 3=Normal, 4=Low
  dueDate: Date.now() + 86400000,  // Tomorrow
});
```

## API Reference

### User

```javascript
client.getUser()  // Get authenticated user info
```

### Teams/Workspaces

```javascript
client.getTeams()           // Get all workspaces
client.getTeam(teamId)      // Get specific workspace
```

### Spaces

```javascript
client.getSpaces(teamId)                    // Get spaces in workspace
client.getSpace(spaceId)                    // Get specific space
client.createSpace(teamId, name, options)   // Create space
```

### Folders

```javascript
client.getFolders(spaceId)           // Get folders in space
client.getFolder(folderId)           // Get specific folder
client.createFolder(spaceId, name)   // Create folder
```

### Lists

```javascript
client.getLists(folderId)                         // Get lists in folder
client.getFolderlessLists(spaceId)                // Get lists without folder
client.getList(listId)                            // Get specific list
client.createList(folderId, name, options)        // Create list in folder
client.createFolderlessList(spaceId, name, opts)  // Create folderless list
```

### Tasks

```javascript
// Get tasks
client.getTasks(listId, options)
client.getTeamTasks(teamId, options)
client.getTask(taskId)
client.getMyTasks(options)  // Helper: all tasks assigned to you

// Task options
{
  page: 0,
  orderBy: 'updated',  // 'created', 'updated', 'due_date'
  reverse: true,
  subtasks: true,
  includeClosed: false,
  assignees: [userId],
  statuses: ['open', 'in progress'],
  dueDateGt: timestamp,
  dueDateLt: timestamp,
}

// Create task
client.createTask(listId, 'Task name', {
  description: 'Description',
  assignees: [userId],
  tags: ['tag1', 'tag2'],
  status: 'open',
  priority: 3,
  dueDate: timestamp,
  customFields: [{ id: 'field_id', value: 'value' }],
})

// Update task
client.updateTask(taskId, { name: 'New name', status: 'complete' })

// Delete task
client.deleteTask(taskId)
```

### Comments

```javascript
client.getTaskComments(taskId)
client.addTaskComment(taskId, 'Comment text', { notifyAll: true })
```

### Tags

```javascript
client.getSpaceTags(spaceId)
client.addTagToTask(taskId, 'tagName')
client.removeTagFromTask(taskId, 'tagName')
```

### Custom Fields

```javascript
client.getListCustomFields(listId)
client.setCustomFieldValue(taskId, fieldId, value)
```

### Time Tracking

```javascript
client.getTaskTimeEntries(taskId)
client.trackTime(taskId, duration, { start, end })
```

### Webhooks

```javascript
client.getWebhooks(teamId)
client.createWebhook(teamId, 'https://your.endpoint/webhook', ['taskCreated', 'taskUpdated'])
client.deleteWebhook(webhookId)
```

### Goals

```javascript
client.getGoals(teamId)
client.getGoal(goalId)
```

### Views

```javascript
client.getTeamViews(teamId)
client.getSpaceViews(spaceId)
client.getFolderViews(folderId)
client.getListViews(listId)
```

### Helper Methods

```javascript
// Get full workspace hierarchy (spaces → folders → lists)
const hierarchy = await client.getWorkspaceHierarchy(teamId);

// Search tasks (client-side filtering)
const results = await client.searchTasks(teamId, 'search query');
```

## Error Handling

```javascript
import { ClickUpClient, ClickUpError } from './clickup-client.js';

try {
  const task = await client.getTask('invalid_id');
} catch (error) {
  if (error instanceof ClickUpError) {
    console.log('Status:', error.status);      // HTTP status code
    console.log('Message:', error.message);    // Error message
    console.log('Response:', error.response);  // Full error response
  }
}
```

## Examples

See `examples/basic-usage.cjs` for a complete working example:

```bash
export CLICKUP_TOKEN="your_token_here"
node API/examples/basic-usage.cjs
```

## Rate Limits

ClickUp API has rate limits:
- 100 requests per minute for most endpoints
- 10 requests per minute for some endpoints

The client does not implement automatic rate limiting. Handle `429` responses in your application.

## License

MIT
