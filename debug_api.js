import axios from 'axios';

const token = 'pk_84233809_XLZT01I51909HAT8HR7E6MJQGRROM63V';
const BASE_URL = 'https://api.clickup.com/api/v2';

async function debug() {
  try {
    console.log('Fetching User...');
    const userRes = await axios.get(`${BASE_URL}/user`, { headers: { Authorization: token } });
    const user = userRes.data.user;
    console.log('User:', user.username, user.id);

    console.log('Fetching Teams...');
    const teamRes = await axios.get(`${BASE_URL}/team`, { headers: { Authorization: token } });
    console.log('Teams found:', teamRes.data.teams.length);
    
    for (const team of teamRes.data.teams) {
        console.log(`Checking Team: ${team.name} (${team.id})`);
        
        try {
            const tasksRes = await axios.get(`${BASE_URL}/team/${team.id}/task`, {
                headers: { Authorization: token },
                params: {
                    'assignees[]': user.id,
                    limit: 10,
                    subtasks: true
                }
            });
            console.log(`Tasks found for team ${team.name}:`, tasksRes.data.tasks.length);
            if (tasksRes.data.tasks.length > 0) {
                console.log('Sample Task Status:', tasksRes.data.tasks[0].status);
            }
        } catch (e) {
            console.error(`Error fetching tasks for team ${team.name}:`, e.response?.data || e.message);
        }
    }

  } catch (error) {
    console.error('Fatal Error:', error.response?.data || error.message);
  }
}

debug();
