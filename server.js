// WGO news server: fetches trusted news feeds every few minutes and serves the Kuwait-centred map.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNews } from './lib/news.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = +(process.env.PORT || 3000);
const REFRESH_MIN = +(process.env.REFRESH_MINUTES || 5);
const feeds = JSON.parse(readFileSync(process.env.FEEDS_FILE || join(ROOT, 'feeds.json'), 'utf8'));
const news = createNews(feeds);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function send(res, code, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(code, { 'content-type': type, 'x-content-type-options': 'nosniff', ...extra });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '{"error":"method not allowed"}');

  if (url.pathname === '/api/stories') {
    const lang = url.searchParams.get('lang') || 'all';
    const body = JSON.stringify({ ...news.snapshot(lang), refreshMinutes: REFRESH_MIN });
    return send(res, 200, body, undefined, { 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
  }
  if (url.pathname === '/healthz') {
    return send(res, news.state.updated ? 200 : 503, JSON.stringify({ updated: news.state.updated, stories: news.state.stories.size }));
  }

  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = normalize(join(ROOT, 'public', rel));
  if (!file.startsWith(join(ROOT, 'public'))) return send(res, 403, 'forbidden', 'text/plain');
  try {
    const data = await readFile(file);
    const cache = extname(file) === '.json' ? 'public, max-age=86400' : 'no-cache';
    send(res, 200, data, TYPES[extname(file)] || 'application/octet-stream', { 'cache-control': cache });
  } catch {
    send(res, 404, 'not found', 'text/plain');
  }
});

server.listen(PORT, () => console.log(`[wgo] listening on http://localhost:${PORT}, refreshing every ${REFRESH_MIN} min from ${feeds.length} feeds`));
news.refresh();
setInterval(() => news.refresh(), REFRESH_MIN * 60e3);
