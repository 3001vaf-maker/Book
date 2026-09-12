import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.cwd(), process.argv[2] || '_site');
const port = Number(process.argv[3] || process.env.PORT || 8080);

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

const server = createServer((request, response) => {
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
