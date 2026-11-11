// Local dev server that mimics Vercel: /api/<name> runs api/<name>.js, clean URLs map to .html files.
// Run: npm run dev  ->  http://localhost:8787
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const cache = new Map(); // simple 60s memo per API route so local dev doesn't hammer free APIs

function runApi(name, req, res) {
  const file = path.join(ROOT, 'api', name + '.js');
  if (!/^[\w-]+$/.test(name) || !fs.existsSync(file)) { res.writeHead(404); return res.end('no such api'); }
  const hit = cache.get(req.url);
  if (hit && Date.now() - hit.t < 60_000) { res.writeHead(200, hit.headers); return res.end(hit.body); }
  const headers = { 'Content-Type': 'application/json' };
  let code = 200;
  const shim = {
    setHeader: (k, v) => { headers[k] = v; },
    status(c) { code = c; return shim; },
    send(body) { if (code === 200) cache.set(req.url, { t: Date.now(), headers, body }); res.writeHead(code, headers); res.end(body); },
    json(obj) { shim.send(JSON.stringify(obj)); },
  };
  delete require.cache[require.resolve(file)]; // pick up edits without restarting
  Promise.resolve(require(file)(req, shim)).catch(e => { res.writeHead(500); res.end(String(e && e.message)); });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const api = url.pathname.match(/^\/api\/([\w-]+)$/);
  if (api) return runApi(api[1], req, res);
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  else if (!path.extname(p)) p += '.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || /[\\/](lib|scripts|node_modules|\.git)[\\/]/.test(file.slice(ROOT.length))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`Pulse on http://localhost:${PORT}`));
