import { createServer } from 'node:http';
import { createPrivateKey, randomUUID, sign, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 4096;

function json(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

function html(response, status, content, type) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  response.end(content);
}

function constantTimeEqual(left, right) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    }
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw Object.assign(new Error('Request must be a JSON object.'), { status: 400 });
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    json(response, 200, { available: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/time') {
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(JSON.stringify({ now: Date.now() }));
    return;
  }

  if (request.method === 'GET' && ['/', '/admin', '/admin/'].includes(url.pathname)) {
    const content = await readFile(join(directory, 'public', 'admin.html'));
    html(response, 200, content, 'text/html; charset=utf-8');
    return;
  }

  if (request.method === 'GET' && ['/admin.css', '/admin.js'].includes(url.pathname)) {
    const type = url.pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
    const content = await readFile(join(directory, 'public', url.pathname.slice(1)));
    html(response, 200, content, type);
    return;
  }

  if (request.method !== 'POST' || url.pathname !== '/api/licenses') {
    json(response, 404, { error: 'Not found.' });
    return;
  }

  const adminToken = process.env.LICENSE_ADMIN_TOKEN;
  const authHeader = request.headers.authorization || '';
  const suppliedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!adminToken || !constantTimeEqual(suppliedToken, adminToken)) {
    json(response, 401, { error: 'Admin token is incorrect.' });
    return;
  }

  const privateKeyBase64 = process.env.LICENSE_PRIVATE_KEY_BASE64;
  if (!privateKeyBase64) {
    json(response, 503, { error: 'License signing is not configured on the server.' });
    return;
  }
  let publicUrl;
  try {
    publicUrl = new URL(process.env.LICENSE_PUBLIC_URL);
  } catch {
    json(response, 503, { error: 'The public HTTPS service URL is not configured on the server.' });
    return;
  }
  if (publicUrl.protocol !== 'https:'
    || publicUrl.username
    || publicUrl.password
    || publicUrl.pathname !== '/'
    || publicUrl.search
    || publicUrl.hash) {
    json(response, 503, { error: 'Configure LICENSE_PUBLIC_URL as the public HTTPS service origin.' });
    return;
  }

  const body = await readJson(request);
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : '';
  const expiryDate = new Date(`${expiresAt}T00:00:00.000Z`);
  if (!deviceId || deviceId.length > 128) {
    json(response, 400, { error: 'Enter a valid device ID.' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)
    || Number.isNaN(expiryDate.getTime())
    || expiryDate.toISOString().slice(0, 10) !== expiresAt
    || expiresAt <= new Date().toISOString().slice(0, 10)) {
    json(response, 400, { error: 'Choose a valid expiry date in the future.' });
    return;
  }

  const licenseId = randomUUID();
  const timeUrl = new URL('/api/time', publicUrl).toString();
  const ticket = {
    licenseId,
    deviceId,
    expiresAt,
    timeUrl,
    signature: sign(
      'RSA-SHA256',
      Buffer.from(`${licenseId}|${deviceId}|${expiresAt}|${timeUrl}`),
      createPrivateKey(Buffer.from(privateKeyBase64, 'base64').toString('utf8'))
    ).toString('base64')
  };
  json(response, 201, {
    activationKey: `LAB1-${Buffer.from(JSON.stringify(ticket)).toString('base64url')}`,
    expiresAt
  });
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch(error => {
    console.error('License admin request failed:', error);
    if (!response.headersSent) {
      json(response, error.status || 500, {
        error: error.status ? error.message : 'Could not create the activation key.'
      });
    } else {
      response.destroy(error);
    }
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
  console.log(`License admin page listening on port ${port}.`);
});
