/**
 * static-server.mjs — zero-dependency static file server that mimics the two
 * Vercel behaviours the nutrition pages rely on: `cleanUrls` (/foo -> foo.html)
 * and correct MIME types for ES modules. For local testing only.
 *
 *   node scripts/static-server.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const candidates = [];
  if (clean === '/' || clean === '') candidates.push('index.html');
  else {
    const rel = clean.replace(/^\/+/, '');
    candidates.push(rel);
    if (!path.extname(rel)) candidates.push(`${rel}.html`, `${rel}/index.html`);
  }
  for (const c of candidates) {
    const abs = path.join(root, c);
    if (!abs.startsWith(root)) continue;
    try {
      const s = await stat(abs);
      if (s.isFile()) return abs;
    } catch {
      /* try next */
    }
  }
  return null;
}

createServer(async (req, res) => {
  const abs = await resolveFile(req.url);
  if (!abs) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
    return;
  }
  const body = await readFile(abs);
  res.writeHead(200, { 'content-type': MIME[path.extname(abs)] || 'application/octet-stream' });
  res.end(body);
}).listen(port, () => console.log(`static-server on http://localhost:${port} (root: ${root})`));
