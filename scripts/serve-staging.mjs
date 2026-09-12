import { createServer, request as proxyRequest } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.cwd(), process.argv[2] || '_site');
const port = Number(process.argv[3] || process.env.PORT || 8080);
const backendHost = String(process.env.STAGING_BACKEND_HOST || 'backend');
const backendPort = Number(process.env.STAGING_BACKEND_PORT || 3000);

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

function safeFile(urlPath) {
  const decoded = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  const relative = normalize(decoded).replace(/^([.]{2}[\\/])+/, '').replace(/^[/\\]+/, '');
  const candidate = resolve(root, relative || 'index.html');
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  if (!extname(relative)) {
    const index = join(root, 'index.html');
    return existsSync(index) ? index : null;
  }
  return null;
}

function proxyApi(request, response) {
  const sourceUrl = new URL(request.url || '/api', 'http://staging.local');
  const upstreamPath = `${sourceUrl.pathname.replace(/^\/api(?=\/|$)/, '') || '/'}${sourceUrl.search}`;
  const headers = { ...request.headers, host: `${backendHost}:${backendPort}` };

  const upstream = proxyRequest({
    hostname: backendHost,
    port: backendPort,
    path: upstreamPath,
    method: request.method,
    headers,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  upstream.on('error', () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ message: 'Staging API unavailable' }));
  });

  request.pipe(upstream);
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url || '/', 'http://staging.local').pathname;
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    proxyApi(request, response);
    return;
  }

  const file = safeFile(request.url || '/');
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': mime.get(extname(file).toLowerCase()) || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Book staging frontend: http://localhost:${port}`);
});
