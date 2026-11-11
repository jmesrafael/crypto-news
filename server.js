// Local dev server. Run: node server.js  ->  http://localhost:8787
// On Vercel, api/news.js and index.html are used instead.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { getNews } = require('./lib/news');

const PORT = Number(process.env.PORT || 8787);
const REFRESH_MS = 60_000;

let cache = { updated: 0, items: [], sources: [] };

async function refresh() {
  cache = await getNews();
  const bad = cache.sources.filter(s => !s.ok).map(s => `${s.name} (${s.error})`);
  console.log(`[${new Date().toISOString()}] ${cache.items.length} items` + (bad.length ? ` | failed: ${bad.join(', ')}` : ''));
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/news')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(cache));
  }
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }
  res.writeHead(404); res.end('not found');
});

refresh().then(() => {
  setInterval(refresh, REFRESH_MS);
  server.listen(PORT, () => console.log(`Crypto news on http://localhost:${PORT}`));
});
