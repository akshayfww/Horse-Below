// Zero-dependency static server (Node only). Usage: node scripts/serve.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
createServer(async (q, r) => {
  let p = normalize(decodeURIComponent(q.url.split('?')[0])).replace(/^(\.\.[\/\\])+/, '');
  if (p.endsWith('/') || p.endsWith('\\')) p += 'index.html';
  try { const d = await readFile(join(process.cwd(), p)); r.writeHead(200, { 'Content-Type': T[extname(p)] || 'application/octet-stream' }); r.end(d); }
  catch { r.writeHead(404); r.end('Not found'); }
}).listen(8080, () => console.log('Open http://localhost:8080'));
