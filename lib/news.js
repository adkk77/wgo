// Fetch every feed, turn items into placed and categorised stories, keep a rolling window.
import { createHash } from 'node:crypto';
import { parseFeed } from './rss.js';
import { classify } from './classify.js';
import { locate, distanceBearing, strike } from './geo.js';
import { normAr } from './arabic.js';

const MAX_AGE_H = +(process.env.MAX_AGE_HOURS || 48);
const MAX_STORIES = +(process.env.MAX_STORIES || 500);
const TIMEOUT_MS = 15000;

export function createNews(feeds) {
  const state = { updated: null, sources: [], stories: new Map(), running: false };

  async function fetchFeed(feed) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(feed.url, {
        signal: ctl.signal,
        headers: { 'user-agent': 'WGO-news-map/0.2 (+news aggregator)', accept: 'application/rss+xml, application/xml, text/xml, */*' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseFeed(await res.text());
    } finally {
      clearTimeout(t);
    }
  }

  function toStory(item, feed) {
    const cat = classify(item.title, item.description, feed.lang);
    if (!cat) return { skip: 'category' };
    const place = locate(item.title, item.description, feed.lang, { kuwaitLocal: !!feed.kuwaitLocal });
    if (!place) return { skip: 'place' };
    const { km, bearing } = distanceBearing(place.lat, place.lon);
    const fromGoogle = feed.url.includes('news.google.com');
    const key = (feed.lang === 'ar' ? normAr(item.title) : item.title.toLowerCase()).replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 80);
    return {
      id: createHash('sha1').update(key).digest('hex').slice(0, 12),
      lang: feed.lang,
      title: item.title,
      summary: item.description && item.description !== item.title ? item.description.slice(0, 280) : '',
      url: item.link,
      // only Google News uses <source> for the outlet; elsewhere it can be a photo credit
      source: (fromGoogle && item.source) || feed.name,
      sourceAr: (fromGoogle && item.source) || feed.nameAr,
      published: (item.date || new Date()).toISOString(),
      category: cat,
      place,
      strike: cat === 'war' ? strike(item.title, feed.lang, place) : null,
      km,
      bearing,
    };
  }

  async function refresh() {
    if (state.running) return;
    state.running = true;
    const started = Date.now();
    const sources = [];
    const queue = [...feeds];
    async function worker() {
      while (queue.length) {
        const feed = queue.shift();
        const row = { name: feed.name, nameAr: feed.nameAr, lang: feed.lang, ok: false, items: 0, kept: 0, error: null };
        try {
          const items = await fetchFeed(feed);
          row.ok = true;
          row.items = items.length;
          for (const it of items) {
            const s = toStory(it, feed);
            if (s.skip) continue;
            if (!state.stories.has(s.id)) state.stories.set(s.id, s);
            row.kept++;
          }
        } catch (e) {
          row.error = e.name === 'AbortError' ? 'timed out' : String(e.message || e);
        }
        sources.push(row);
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));
    // rolling window: drop old stories, cap the total
    const cutoff = Date.now() - MAX_AGE_H * 3600e3;
    const kept = [...state.stories.values()]
      .filter((s) => Date.parse(s.published) >= cutoff)
      .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
      .slice(0, MAX_STORIES);
    state.stories = new Map(kept.map((s) => [s.id, s]));
    state.sources = sources.sort((a, b) => feeds.findIndex((f) => f.name === a.name) - feeds.findIndex((f) => f.name === b.name));
    state.updated = new Date().toISOString();
    state.running = false;
    const ok = sources.filter((s) => s.ok).length;
    console.log(`[wgo] refreshed ${ok}/${feeds.length} feeds, ${state.stories.size} stories, ${Date.now() - started} ms`);
  }

  function snapshot(lang) {
    const stories = [...state.stories.values()].filter((s) => !lang || lang === 'all' || s.lang === lang);
    return { updated: state.updated, sources: state.sources.filter((s) => !lang || lang === 'all' || s.lang === lang), stories };
  }

  return { refresh, snapshot, state };
}
