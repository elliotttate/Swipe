/**
 * ClickUp API Client
 * 
 * Supports multiple authentication methods:
 * - Personal API Token (pk_*)
 * - OAuth Token
 * - Session JWT (cu_jwt cookie) - for private API access
 * 
 * Usage:
 *   const client = new ClickUpClient({ token: 'your_token' });
 *   const user = await client.getUser();
 *   const teams = await client.getTeams();
 */

const BASE_URL = 'https://api.clickup.com';

class ClickUpClient {
  /**
   * Create a new ClickUp API client
   * @param {Object} options - Configuration options
   * @param {string} options.token - API token (personal, OAuth, or session JWT)
   * @param {string} [options.apiVersion='v2'] - API version to use (v1 or v2)
   */
  constructor(options = {}) {
    if (!options.token) {
      throw new Error('Token is required');
    }
    
    this.token = options.token;
    this.apiVersion = options.apiVersion || 'v2';
    this.baseUrl = `${BASE_URL}/api/${this.apiVersion}`;
    
    // For session JWTs, v1 API works better
    if (this._isSessionToken()) {
      this.baseUrl = `${BASE_URL}/v1`;
    }
  }

  /**
   * Check if the token appears to be a session JWT
   */
  _isSessionToken() {
    // Session JWTs are longer and contain specific claims
    try {
      if (this.token.split('.').length === 3) {
        const payload = JSON.parse(Buffer.from(this.token.split('.')[1], 'base64').toString());
        return payload.session_token === true || payload.ws_key !== undefined;
      }
    } catch (e) {
      // Not a JWT
    }
    return false;
  }

  /**
   * Check if using a personal API token
   */
  _isPersonalToken() {
    return this.token.startsWith('pk_');
  }

  /**
   * Make an authenticated request to the ClickUp API
   */
  async _request(method, endpoint, data = null, params = null) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(`${key}[]`, v));
        } else if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }

    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const options = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url.toString(), options);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ err: response.statusText }));
      throw new ClickUpError(error.err || error.message || 'API Error', response.status, error);
    }

    return response.json();
  }

  // ==================== User ====================

  /**
   * Get the authenticated user
   */
  async getUser() {
    const data = await this._request('GET', '/user');
    return data.user || data;
  }

  // ==================== Teams/Workspaces ====================

  /**
   * Get all workspaces (teams) the user has access to
   */
  async getTeams() {
    const data = await this._request('GET', '/team');
    return data.teams || data;
  }

  /**
   * Get a specific team by ID
   */
  async getTeam(teamId) {
    return this._request('GET', `/team/${teamId}`);
  }

  // ==================== Spaces ====================

  /**
   * Get all spaces in a team
   */
  async getSpaces(teamId, archived = false) {
    const data = await this._request('GET', `/team/${teamId}/space`, null, { archived });
    return data.spaces || data;
  }

  /**
   * Get a specific space
   */
  async getSpace(spaceId) {
    return this._request('GET', `/space/${spaceId}`);
  }

  /**
   * Create a new space
   */
  async createSpace(teamId, name, options = {}) {
    return this._request('POST', `/team/${teamId}/space`, {
      name,
      multiple_assignees: options.multipleAssignees ?? true,
      features: options.features || {},
      ...options
    });
  }

  // ==================== Folders ====================

  /**
   * Get all folders in a space
   */
  async getFolders(spaceId, archived = false) {
    const data = await this._request('GET', `/space/${spaceId}/folder`, null, { archived });
    return data.folders || data;
  }

  /**
   * Get a specific folder
   */
  async getFolder(folderId) {
    return this._request('GET', `/folder/${folderId}`);
  }

  /**
   * Create a new folder
   */
  async createFolder(spaceId, name) {
    return this._request('POST', `/space/${spaceId}/folder`, { name });
  }

  // ==================== Lists ====================

  /**
   * Get all lists in a folder
   */
  async getLists(folderId, archived = false) {
    const data = await this._request('GET', `/folder/${folderId}/list`, null, { archived });
    return data.lists || data;
  }

  /**
   * Get folderless lists in a space
   */
  async getFolderlessLists(spaceId, archived = false) {
    const data = await this._request('GET', `/space/${spaceId}/list`, null, { archived });
    return data.lists || data;
  }

  /**
   * Get a specific list
   */
  async getList(listId) {
    return this._request('GET', `/list/${listId}`);
  }

  /**
   * Create a new list
   */
  async createList(folderId, name, options = {}) {
    return this._request('POST', `/folder/${folderId}/list`, { name, ...options });
  }

  /**
   * Create a folderless list
   */
  async createFolderlessList(spaceId, name, options = {}) {
    return this._request('POST', `/space/${spaceId}/list`, { name, ...options });
  }

  // ==================== Tasks ====================

  /**
   * Get tasks in a list
   */
  async getTasks(listId, options = {}) {
    const data = await this._request('GET', `/list/${listId}/task`, null, {
      archived: options.archived ?? false,
      page: options.page ?? 0,
      order_by: options.orderBy || 'updated',
      reverse: options.reverse ?? true,
      subtasks: options.subtasks ?? true,
      statuses: options.statuses,
      include_closed: options.includeClosed ?? false,
      assignees: options.assignees,
      due_date_gt: options.dueDateGt,
      due_date_lt: options.dueDateLt,
      date_created_gt: options.dateCreatedGt,
      date_created_lt: options.dateCreatedLt,
      date_updated_gt: options.dateUpdatedGt,
      date_updated_lt: options.dateUpdatedLt,
    });
    return data.tasks || data;
  }

  /**
   * Get tasks from a team/workspace (filtered)
   */
  async getTeamTasks(teamId, options = {}) {
    const data = await this._request('GET', `/team/${teamId}/task`, null, {
      page: options.page ?? 0,
      order_by: options.orderBy || 'updated',
      reverse: options.reverse ?? true,
      subtasks: options.subtasks ?? true,
      statuses: options.statuses,
      include_closed: options.includeClosed ?? false,
      assignees: options.assignees,
      space_ids: options.spaceIds,
      project_ids: options.projectIds,
      list_ids: options.listIds,
      due_date_gt: options.dueDateGt,
      due_date_lt: options.dueDateLt,
    });
    return data.tasks || data;
  }

  /**
   * Get a specific task
   */
  async getTask(taskId, options = {}) {
    return this._request('GET', `/task/${taskId}`, null, {
      custom_task_ids: options.customTaskIds,
      team_id: options.teamId,
      include_subtasks: options.includeSubtasks ?? true,
    });
  }

  /**
   * Create a new task
   */
  async createTask(listId, name, options = {}) {
    return this._request('POST', `/list/${listId}/task`, {
      name,
      description: options.description,
      assignees: options.assignees,
      tags: options.tags,
      status: options.status,
      priority: options.priority,
      due_date: options.dueDate,
      due_date_time: options.dueDatetime ?? true,
      time_estimate: options.timeEstimate,
      start_date: options.startDate,
      start_date_time: options.startDatetime,
      notify_all: options.notifyAll ?? true,
      parent: options.parent,
      links_to: options.linksTo,
      check_required_custom_fields: options.checkRequiredCustomFields,
      custom_fields: options.customFields,
      ...options
    });
  }

  /**
   * Update a task
   */
  async updateTask(taskId, updates, options = {}) {
    return this._request('PUT', `/task/${taskId}`, updates, {
      custom_task_ids: options.customTaskIds,
      team_id: options.teamId,
    });
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId, options = {}) {
    return this._request('DELETE', `/task/${taskId}`, null, {
      custom_task_ids: options.customTaskIds,
      team_id: options.teamId,
    });
  }

  // ==================== Comments ====================

  /**
   * Get comments on a task
   */
  async getTaskComments(taskId, options = {}) {
    const data = await this._request('GET', `/task/${taskId}/comment`, null, {
      custom_task_ids: options.customTaskIds,
      team_id: options.teamId,
      start: options.start,
      start_id: options.startId,
    });
    return data.comments || data;
  }

  /**
   * Add a comment to a task
   */
  async addTaskComment(taskId, commentText, options = {}) {
    return this._request('POST', `/task/${taskId}/comment`, {
      comment_text: commentText,
      assignee: options.assignee,
      notify_all: options.notifyAll ?? false,
    }, {
      custom_task_ids: options.customTaskIds,
      team_id: options.teamId,
    });
  }

  // ==================== Checklists ====================

  /**
   * Create a checklist on a task
   */
  async createChecklist(taskId, name, options = {}) {
    return this._request('POST', `/task/${taskId}/checklist`, { name }, {
      custom_task_ids: options.customTaskIds,
      team_id: options.teamId,
    });
  }

  /**
   * Create a checklist item
   */
  async createChecklistItem(checklistId, name, options = {}) {
    return this._request('POST', `/checklist/${checklistId}/checklist_item`, {
      name,
      assignee: options.assignee,
    });
  }

  // ==================== Time Tracking ====================

  /**
   * Get time entries for a task
   */
  async getTaskTimeEntries(taskId, options = {}) {
    const data = await this._request('GET', `/task/${taskId}/time`, null, {
      custom_task_ids: options.customTaskIds,
      team_id: options.teamId,
    });
    return data.data || data;
  }

  /**
   * Track time on a task
   */
  async trackTime(taskId, duration, options = {}) {
    return this._request('POST', `/task/${taskId}/time`, {
      duration,
      start: options.start,
      end: options.end,
      ...options
    }, {
      custom_task_ids: options.customTaskIds,
      team_id: options.teamId,
    });
  }

  // ==================== Tags ====================

  /**
   * Get tags in a space
   */
  async getSpaceTags(spaceId) {
    const data = await this._request('GET', `/space/${spaceId}/tag`);
    return data.tags || data;
  }

  /**
   * Add tag to a task
   */
  async addTagToTask(taskId, tagName, options = {}) {
    return this._request('POST', `/task/${taskId}/tag/${tagName}`, null, {
      custom_task_ids: options.customTaskIds,
      team_id: options.teamId,
    });
  }

  /**
   * Remove tag from a task
   */
  async removeTagFromTask(taskId, tagName, options = {}) {
    return this._request('DELETE', `/task/${taskId}/tag/${tagName}`, null, {
      custom_task_ids: options.customTaskIds,
      team_id: options.teamId,
    });
  }

  // ==================== Custom Fields ====================

  /**
   * Get custom fields for a list
   */
  async getListCustomFields(listId) {
    const data = await this._request('GET', `/list/${listId}/field`);
    return data.fields || data;
  }

  /**
   * Set custom field value on a task
   */
  async setCustomFieldValue(taskId, fieldId, value, options = {}) {
    return this._request('POST', `/task/${taskId}/field/${fieldId}`, { value }, {
      custom_task_ids: options.customTaskIds,
      team_id: options.teamId,
    });
  }

  // ==================== Views ====================

  /**
   * Get views for a team
   */
  async getTeamViews(teamId) {
    const data = await this._request('GET', `/team/${teamId}/view`);
    return data.views || data;
  }

  /**
   * Get views for a space
   */
  async getSpaceViews(spaceId) {
    const data = await this._request('GET', `/space/${spaceId}/view`);
    return data.views || data;
  }

  /**
   * Get views for a folder
   */
  async getFolderViews(folderId) {
    const data = await this._request('GET', `/folder/${folderId}/view`);
    return data.views || data;
  }

  /**
   * Get views for a list
   */
  async getListViews(listId) {
    const data = await this._request('GET', `/list/${listId}/view`);
    return data.views || data;
  }

  // ==================== Webhooks ====================

  /**
   * Get webhooks for a team
   */
  async getWebhooks(teamId) {
    const data = await this._request('GET', `/team/${teamId}/webhook`);
    return data.webhooks || data;
  }

  /**
   * Create a webhook
   */
  async createWebhook(teamId, endpoint, events, options = {}) {
    return this._request('POST', `/team/${teamId}/webhook`, {
      endpoint,
      events,
      space_id: options.spaceId,
      folder_id: options.folderId,
      list_id: options.listId,
      task_id: options.taskId,
    });
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId) {
    return this._request('DELETE', `/webhook/${webhookId}`);
  }

  // ==================== Goals ====================

  /**
   * Get goals for a team
   */
  async getGoals(teamId, includeCompleted = false) {
    const data = await this._request('GET', `/team/${teamId}/goal`, null, {
      include_completed: includeCompleted,
    });
    return data.goals || data;
  }

  /**
   * Get a specific goal
   */
  async getGoal(goalId) {
    return this._request('GET', `/goal/${goalId}`);
  }

  // ==================== Guests ====================

  /**
   * Get guests in a team
   */
  async getGuests(teamId) {
    const data = await this._request('GET', `/team/${teamId}/guest`);
    return data.guests || data;
  }

  // ==================== Helper Methods ====================

  /**
   * Get all tasks assigned to the current user across all workspaces
   */
  async getMyTasks(options = {}) {
    const user = await this.getUser();
    const teams = await this.getTeams();
    
    const allTasks = [];
    
    for (const team of teams) {
      try {
        const tasks = await this.getTeamTasks(team.id, {
          assignees: [user.id],
          includeClosed: options.includeClosed ?? false,
          ...options
        });
        allTasks.push(...tasks);
      } catch (e) {
        console.warn(`Failed to fetch tasks for team ${team.name}:`, e.message);
      }
    }

    // Dedupe and sort
    const uniqueTasks = Array.from(new Map(allTasks.map(t => [t.id, t])).values());
    return uniqueTasks.sort((a, b) => {
      return parseInt(b.date_updated || 0) - parseInt(a.date_updated || 0);
    });
  }

  /**
   * Search tasks
   */
  async searchTasks(teamId, query) {
    // Note: ClickUp doesn't have a native search endpoint in the public API
    // This is a workaround using task filtering
    const tasks = await this.getTeamTasks(teamId, { includeClosed: false });
    const lowerQuery = query.toLowerCase();
    
    return tasks.filter(task => 
      task.name.toLowerCase().includes(lowerQuery) ||
      (task.description && task.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get the full workspace hierarchy (spaces, folders, lists)
   */
  async getWorkspaceHierarchy(teamId) {
    const spaces = await this.getSpaces(teamId);
    
    const hierarchy = await Promise.all(spaces.map(async (space) => {
      const [folders, folderlessLists] = await Promise.all([
        this.getFolders(space.id),
        this.getFolderlessLists(space.id),
      ]);

      const foldersWithLists = await Promise.all(folders.map(async (folder) => {
        const lists = await this.getLists(folder.id);
        return { ...folder, lists };
      }));

      return {
        ...space,
        folders: foldersWithLists,
        lists: folderlessLists,
      };
    }));

    return hierarchy;
  }
}

/**
 * Custom error class for ClickUp API errors
 */
class ClickUpError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'ClickUpError';
    this.status = status;
    this.response = response;
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ClickUpClient, ClickUpError };
}

export { ClickUpClient, ClickUpError };
export default ClickUpClient;
