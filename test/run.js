// End-to-end check with local sample feeds: no internet needed.
// Starts a tiny feed server, runs the real WGO server against it, and checks the API.
import http from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const here = new URL('.', import.meta.url).pathname;
const fx = (n) => readFileSync(join(here, 'fixtures', n));

const feedServer = http.createServer((req, res) => {
  if (req.url === '/down') { res.writeHead(500); return res.end(); }
  res.writeHead(200, { 'content-type': 'application/rss+xml' });
  res.end(fx(req.url.slice(1).split('?')[0]));
}).listen(0);
await new Promise((r) => feedServer.once('listening', r));
const fp = feedServer.address().port;
const base = `http://127.0.0.1:${fp}`;

const dir = mkdtempSync(join(tmpdir(), 'wgo-'));
const feedsFile = join(dir, 'feeds.json');
writeFileSync(feedsFile, JSON.stringify([
  { name: 'Sample Arabic', nameAr: 'عينة عربية', lang: 'ar', url: `${base}/ar.xml` },
  { name: 'Al Qabas (sample)', nameAr: 'القبس', lang: 'ar', kuwaitLocal: true, url: `${base}/kw-ar.xml` },
  { name: 'Sample English', nameAr: 'عينة إنجليزية', lang: 'en', url: `${base}/en.xml` },
  { name: 'Times Kuwait (sample)', nameAr: 'تايمز الكويت', lang: 'en', kuwaitLocal: true, url: `${base}/timeskuwait.xml` },
  { name: 'Broken feed', nameAr: 'مصدر معطل', lang: 'en', url: `${base}/down` },
]));

const PORT = 3900 + Math.floor(Math.random() * 90);
const app = spawn(process.execPath, [join(here, '..', 'server.js')], {
  env: { ...process.env, PORT: String(PORT), FEEDS_FILE: feedsFile, MAX_AGE_HOURS: '1000000' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
app.stdout.on('data', (d) => process.stdout.write(d));

async function get(path) {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${path}`);
      if (r.ok) return r;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not answer ' + path);
}

let failed = false;
try {
  await get('/healthz');
  const ar = await (await get('/api/stories?lang=ar')).json();
  const en = await (await get('/api/stories?lang=en')).json();
  const byTitle = (d, s) => d.stories.find((x) => x.title.includes(s));

  // Arabic
  assert.equal(byTitle(ar, 'مضيق هرمز').category, 'war');
  assert.equal(byTitle(ar, 'مضيق هرمز').place.ar, 'مضيق هرمز');
  assert.equal(byTitle(ar, 'زلزال').category, 'crisis');
  assert.equal(byTitle(ar, 'زلزال').place.ar, 'تركيا');
  assert.equal(byTitle(ar, 'أسعار النفط').category, 'financial');
  assert.equal(byTitle(ar, 'الفروانية').category, 'crime');
  assert.equal(byTitle(ar, 'الفروانية').place.ar, 'الفروانية');
  assert.equal(byTitle(ar, 'الإيطالي').place.name, 'Kuwait City', 'adjective “Italian” should not move a Kuwaiti story to Rome');
  assert.equal(byTitle(ar, 'المطلاع').place.ar, 'المطلاع');
  assert.ok(!byTitle(ar, 'مباراة'), 'sport is filtered out');
  assert.ok(!byTitle(ar, 'القبس'), 'Google News " - outlet" suffix is stripped');
  assert.equal(byTitle(ar, 'ودائع').source, 'القبس');

  // English
  assert.equal(byTitle(en, 'Qeshm').place.name, 'Qeshm');
  assert.equal(byTitle(en, 'Qeshm').category, 'war');
  assert.equal(byTitle(en, 'Komyshuvakha')?.category ?? 'war', 'war');
  assert.equal(byTitle(en, 'crude output').place.name, 'Kuwait City');
  assert.equal(byTitle(en, 'crude output').category, 'financial');
  assert.ok(!byTitle(en, 'Liverpool'), 'sport is filtered out');
  assert.ok(en.stories.every((s) => !s.title.endsWith(' - Reuters')));
  const broken = en.sources.find((s) => s.name === 'Broken feed');
  assert.equal(broken.ok, false);

  // every story has a real position and distance
  for (const s of [...ar.stories, ...en.stories]) {
    assert.ok(Number.isFinite(s.place.lat) && Number.isFinite(s.km) && s.bearing >= 0 && s.bearing < 360, s.title);
  }
  const page = await (await get('/')).text();
  assert.ok(page.includes('dir="rtl"'), 'page is Arabic-first');

  console.log(`\nOK  Arabic: ${ar.stories.length} stories, English: ${en.stories.length} stories`);
  const tally = (d) => Object.entries(d.stories.reduce((m, s) => ((m[s.category] = (m[s.category] || 0) + 1), m), {})).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log('    ar:', tally(ar));
  console.log('    en:', tally(en));
  const unplaced = (d) => d.sources.reduce((n, s) => n + s.items - s.kept, 0);
  console.log(`    dropped (no category or no place): ar ${unplaced(ar)}, en ${unplaced(en)}`);
} catch (e) {
  failed = true;
  console.error('\nFAIL', e.message);
} finally {
  app.kill();
  feedServer.close();
  process.exit(failed ? 1 : 0);
}
