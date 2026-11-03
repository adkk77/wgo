// Minimal RSS 2.0 / RDF / Atom parser with no dependencies.
// Good enough for news feeds; not a general XML parser.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decode(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

export function stripTags(s = '') {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const clean = (s) => stripTags(decode(decode(s || '')));

function tag(block, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}

function attr(block, name, a) {
  const re = new RegExp(`<${name}\\b[^>]*\\b${a}=["']([^"']+)["']`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}

export function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    let title = clean(tag(b, 'title'));
    let link = clean(tag(b, 'link')) || attr(b, 'link', 'href') || clean(tag(b, 'guid'));
    const description = clean(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'));
    const dateStr = clean(tag(b, 'pubDate') || tag(b, 'dc:date') || tag(b, 'published') || tag(b, 'updated'));
    const date = dateStr ? new Date(dateStr) : null;
    // Google News puts the outlet in <source> and appends " - Outlet" to the title
    const source = clean(tag(b, 'source'));
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3)).trim();
    if (!title || !link) continue;
    items.push({ title, link, description: description.slice(0, 600), date: date && !isNaN(date) ? date : null, source: source || null });
  }
  return items;
}
