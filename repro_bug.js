const http = require('http');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body ? JSON.parse(body) : null
                });
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function run() {
    try {
        const username = 'reproUser_' + Date.now();
        const email = `repro_${Date.now()}@test.com`;
        const password = 'password123';

        console.log(`Registering user: ${username}...`);

        // 1. Register
        const regRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { username, email, password });

        console.log('Register response:', regRes.body);

        if (!regRes.body.success) {
            throw new Error('Registration failed');
        }

        // Get cookies
        const cookies = regRes.headers['set-cookie'];
        console.log('Cookies:', cookies);

        // 2. Create Room
        console.log('Creating room...');
        const createRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/rooms/create',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies
            }
        }, {
            roomId: 'DEBUG-' + Date.now(),
            name: 'Debug Room',
            password: 'roompassword'
        });

        console.log('Create Room Response:', createRes.body);

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
