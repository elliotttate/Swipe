const https = require('https');

// Cookie string provided by the user
const cookieString = `cu_refresh=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNiVkFxWkNGdVJBPSJ9.eyJ1c2VyIjo4NDIzMzgwOSwicmVmcmVzaCI6dHJ1ZSwiZGF0ZUlzc3VlZCI6MTc2NDk3MDMwMDczMCwid3Nfa2V5IjoiMTczMjEyOTM3MCIsInNlc3Npb25fdG9rZW4iOnRydWUsIndvcmtzcGFjZXMiOlt7InR5cGUiOiJwYXNzd29yZCJ9XSwiaWF0IjoxNzY0OTcwMzAwfQ.4y4uJ7iKmxqnmTolIZ6hpRCC3f3Xwdfr34vBwoOdgcA; rollout_bucket_v1=48; __canny__experimentID=627c21a5-80fa-cc67-abf5-b5fbd12e037b; __stripe_mid=ec44e62e-8eca-45a4-8692-91134eb0cebf3cc16c; _rdt_uuid=1764970297218.25db6fcd-070c-4fa7-8889-5ed3f929fa2a; cu_attachment_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNiVkFxWkNGdVJBPSJ9.eyJ1c2VyIjo4NDIzMzgwOSwidmFsaWRhdGVkIjp0cnVlLCJ3c19rZXkiOiIxNzMyMTI5MzcwIiwiYXR0YWNobWVudCI6dHJ1ZSwic2Vzc2lvbl90b2tlbiI6dHJ1ZSwid29ya3NwYWNlcyI6W3sidHlwZSI6InBhc3N3b3JkIn1dLCJpYXQiOjE3NjUwNTcwMjgsImV4cCI6MTc2NTIyOTgyOH0.mUC6Dc8FUST8EG_dcNXz0Qh0jl_2masfwixXwe4kxHk; cu_form_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNiVkFxWkNGdVJBPSJ9.eyJ1c2VyIjo4NDIzMzgwOSwidmFsaWRhdGVkIjp0cnVlLCJ3c19rZXkiOiIxNzMyMTI5MzcwIiwiZm9ybSI6dHJ1ZSwic2Vzc2lvbl90b2tlbiI6dHJ1ZSwid29ya3NwYWNlcyI6W3sidHlwZSI6InBhc3N3b3JkIn1dLCJpYXQiOjE3NjUwNTcwMjgsImV4cCI6MTc2NTIyOTgyOH0.vPMsq1LlyR0NMaxXWEyjLTCr5yCBkyCcOk0irxRxBqw; cu_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNiVkFxWkNGdVJBPSJ9.eyJ1c2VyIjo4NDIzMzgwOSwidmFsaWRhdGVkIjp0cnVlLCJ3c19rZXkiOiIxNzMyMTI5MzcwIiwic2Vzc2lvbl90b2tlbiI6dHJ1ZSwid29ya3NwYWNlcyI6W3sidHlwZSI6InBhc3N3b3JkIn1dLCJpYXQiOjE3NjUwNTcwMjgsImV4cCI6MTc2NTIyOTgyOH0.AkA7lTYXaotOODLcgnVH1E_f5_ObU_u2WG2v9RpyLJc; __cf_bm=Cyts7h79mfA9QhTgmlmhwI_QK3HaHsDDVq_7r_90AJQ-1765056684-1.0.1.1-kJcnWPaj2ggSvE21GDqe56iYhK2TY1GxETLsp7ZbtIhmaMkMEZIwLlWxB36JoBSnZ816fMNBsYdB9gFnS4UMpwjfKbgznsaTJwOys078nRk`;

// Extract cu_jwt token for Authorization header
const cuJwt = cookieString.split('; ').find(c => c.startsWith('cu_jwt=')).split('=')[1];

// Helper to make requests
function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
        });
        req.on('error', reject);
        req.end();
    });
}

// Function to test authentication with the ClickUp private API
async function testClickUpAuth() {
    console.log('Testing ClickUp authentication with provided cookies...\n');
    console.log('JWT payload:', JSON.parse(Buffer.from(cuJwt.split('.')[1], 'base64').toString()), '\n');
    
    // ClickUp's internal API - trying known patterns
    const endpoints = [
        { host: 't.clickup.com', path: '/v1/user' },
        { host: 't.clickup.com', path: '/user' },
        { host: 'app.clickup.com', path: '/api/v1/user' },
        { host: 'prod-api.clickup.com', path: '/v1/user' },
    ];
    
    for (const endpoint of endpoints) {
        console.log(`\n--- Trying ${endpoint.host}${endpoint.path} ---`);
        
        const options = {
            hostname: endpoint.host,
            path: endpoint.path,
            method: 'GET',
            headers: {
                'Cookie': cookieString,
                'Authorization': cuJwt,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Origin': 'https://app.clickup.com',
                'Referer': 'https://app.clickup.com/',
                'x-requested-with': 'XMLHttpRequest'
            }
        };
        
        try {
            const result = await makeRequest(options);
            console.log('Status:', result.status);
            const contentType = result.headers['content-type'] || '';
            console.log('Content-Type:', contentType);
            
            if (contentType.includes('json')) {
                try {
                    const parsed = JSON.parse(result.data);
                    console.log('Response:', JSON.stringify(parsed, null, 2));
                    if (result.status === 200 && !parsed.err) {
                        console.log('\n✅ SUCCESS! Found working endpoint');
                        return { success: true, endpoint, data: parsed };
                    }
                } catch(e) {
                    console.log('Response (raw):', result.data.substring(0, 500));
                }
            } else {
                console.log('Response is HTML/other, skipping...');
            }
        } catch(e) {
            console.log('Error:', e.message);
        }
    }
    
    console.log('\n\nTrying the public v2 API with JWT as bearer token...\n');
    
    // Try the public API with the JWT as bearer token
    const publicApiOptions = {
        hostname: 'api.clickup.com',
        path: '/api/v2/user',
        method: 'GET',
        headers: {
            'Authorization': cuJwt,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
        }
    };
    
    console.log('--- Trying api.clickup.com/api/v2/user with JWT as bearer token ---');
    try {
        const result = await makeRequest(publicApiOptions);
        console.log('Status:', result.status);
        const contentType = result.headers['content-type'] || '';
        console.log('Content-Type:', contentType);
        
        try {
            const parsed = JSON.parse(result.data);
            console.log('Response:', JSON.stringify(parsed, null, 2));
            if (result.status === 200 && parsed.user) {
                console.log('\n✅ SUCCESS!');
                return { success: true, data: parsed };
            }
        } catch(e) {
            console.log('Response (raw):', result.data.substring(0, 500));
        }
    } catch(e) {
        console.log('Error:', e.message);
    }
    
    return { success: false };
}

// Run the test
testClickUpAuth().catch(console.error);
