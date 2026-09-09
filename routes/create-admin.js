const http = require('https');

const data = JSON.stringify({
  full_name: 'Admin',
  email: 'owiredumantey8+admin@gmail.com',
  phone_number: '0000000000',
  password: 'Agenda111',
  role: 'admin'
});

const options = {
  hostname: 'postaltrack-backend-production.up.railway.app',
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('RESPONSE:', body));
});

req.on('error', e => console.error('ERROR:', e.message));
req.write(data);
req.end();