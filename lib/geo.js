// Find where a story happened from its text, using the gazetteer in data/places.json.
// The most specific place wins (a Kuwait district beats a city beats a country);
// among equals, the one mentioned first wins.
import { readFileSync } from 'node:fs';
import { normAr, arPattern, enPattern } from './arabic.js';

export const KUWAIT = { lat: 29.3759, lon: 47.9783 };
const RANK = { kuwait: 3, place: 2, country: 1 };
const AR_UNSAFE = new Set(['Mali', 'Oman', 'Benin', 'Mashhad', 'Kabd, Kuwait', 'Subiya, Kuwait', 'Wafra, Kuwait', 'El Obeid', 'Kharg Island']);

const places = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url), 'utf8')).map((p) => ({
  ...p,
  en: [p.name.replace(/, Kuwait$/, ''), ...p.aliases].filter((a) => a.length > 1).map(enPattern),
  // the display name counts as an alias too, except names that are also common words
  arP: [...new Set([AR_UNSAFE.has(p.name) ? null : p.ar, ...(p.aliasesAr || [])].filter(Boolean))].map(arPattern),
}));
const kuwaitCity = places.find((p) => p.name === 'Kuwait City');

function firstHit(patterns, text) {
  let best = null;
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && (!best || m.index < best.idx)) best = { idx: m.index, word: m[1] };
  }
  return best;
}

// "Italian minister", "الوزير الإيطالي": an adjective, not a location
function isDemonym(word, lang) {
  return lang === 'ar' ? /^[وفبلك]*ال.*ي(ه|ين|ون)?$/.test(word) : /(an|ans|ese|ish|i|iy)$/i.test(word) && !/^(Oman|Iran|Japan|Sudan|Taiwan|Jordan|Pakistan|Afghanistan|Kazakhstan|Uzbekistan|Tajikistan|Bahrain|Mali|Washington|Tehran)$/i.test(word);
}

export function locate(title, description, lang, { kuwaitLocal = false } = {}) {
  const fields = lang === 'ar' ? [normAr(title), normAr(description)] : [title, description];
  const hits = [];
  fields.forEach((text, fi) => {
    if (!text) return;
    for (const p of places) {
      const h = firstHit(lang === 'ar' ? p.arP : p.en, text);
      // title hits beat summary hits; then specificity; then earliest mention
      if (h) hits.push({ p, demonym: p.kind === 'country' && isDemonym(h.word, lang), key: [fi === 0 ? 1 : 0, RANK[p.kind], -h.idx] });
    }
  });
  hits.sort((a, b) => cmp(b.key, a.key));
  let p = hits[0]?.p;
  if (kuwaitLocal) {
    // Kuwaiti outlets: a story that names Kuwait in its headline happens in Kuwait unless a
    // specific foreign place is named, and a story that names nowhere is local.
    const kw = hits.find((h) => h.key[0] === 1 && (h.p.kind === 'kuwait' || h.p.name === 'Kuwait'));
    // Foreign countries named only as adjectives ("receives the Italian minister") stay in Kuwait.
    const foreign = hits.find((h) => h.p.kind !== 'country' || (!h.demonym && h.key[0] === 1));
    if (!p || (kw && p.kind === 'country') || !foreign) p = kw ? kw.p : kuwaitCity;
    else p = foreign.p.name === 'Kuwait' ? kuwaitCity : (kw && foreign.p.kind === 'country' ? kw.p : foreign.p);
  }
  if (p && p.name === 'Kuwait') p = kuwaitCity;
  if (!p) return null;
  return { name: p.name, ar: p.ar || p.name, lat: p.lat, lon: p.lon };
}

function cmp(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

const R = 6371.0088, rad = Math.PI / 180;
export function distanceBearing(lat, lon) {
  const φ1 = KUWAIT.lat * rad, φ2 = lat * rad, dλ = (lon - KUWAIT.lon) * rad, dφ = φ2 - φ1;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  const y = Math.sin(dλ) * Math.cos(φ2), x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return { km: Math.round(km), bearing: Math.round((Math.atan2(y, x) / rad + 360) % 360) };
}

// War map: for an attack headline, guess who fired (origin) and where it landed (target).
// Only for titles with an attack word that name two places at least 150 km apart.
const ATTACK = {
  en: /\b(strikes?|struck|airstrikes?|missiles?|rockets?|drones?|attack(s|ed)?|bomb(s|ed|ing)?|shell(s|ed|ing)|fires?|fired|launch(es|ed)?|hits?|intercept(s|ed)?)\b/i,
  ar: /(ضرب|غار|قصف|صاروخ|صواريخ|مسير|هجوم|هجمات|استهداف|يستهدف|تستهدف|اطلاق|قذائف|اعتراض)/,
};
const TO_WORD = { en: /\b(on|at|against|toward|towards|into|in)\s*$/i, ar: /(علي|على|ضد|نحو|باتجاه|في|الي|الى|إلى)\s*$/ };
function hav(a, b) {
  const p1 = a.lat * rad, p2 = b.lat * rad, dp = (b.lat - a.lat) * rad, dl = (b.lon - a.lon) * rad;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2)));
}
const MAYBE = {
  en: /\b(warns?|could|may|might|would|threat(en)?s?|fears?|tensions?|deal|talks|(is|was|were|are) attacked|under attack)\b/i,
  ar: /(يحذر|تحذر|حذر|يهدد|تهدد|تعرض|مخاوف|توتر|مفاوضات|محادثات|اتفاق|(^|\s)قد\s)/,
};
export function strike(title, lang, place) {
  const text = lang === 'ar' ? normAr(title) : title;
  // only plain reports of an attack, not warnings, threats or ships that were hit
  if (!ATTACK[lang].test(text) || MAYBE[lang].test(text)) return null;
  const hits = [];
  for (const p of places) {
    if (p.kind === 'kuwait' && p.name !== 'Kuwait City, Kuwait') continue;
    let first = null, marked = false;
    for (const re of lang === 'ar' ? p.arP : p.en) {
      for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
        if (first === null || m.index < first) first = m.index;
        if (TO_WORD[lang].test(text.slice(Math.max(0, m.index - 12), m.index + 1))) marked = true;
      }
    }
    if (first !== null) hits.push({ p: p.name === 'Kuwait' ? kuwaitCity : p, idx: first, marked });
  }
  if (hits.length < 2) return null;
  hits.sort((a, b) => a.idx - b.idx);
  // the target follows "on/at/against"; otherwise the headline's subject fired at the next place named.
  // Whoever fired must be a country (or a group named after one, like the Houthis for Yemen).
  const marked = hits.find((h) => h.marked);
  let from, to;
  if (marked) { to = marked.p; from = hits.find((h) => h.idx < marked.idx && h.p.kind === 'country' && hav(h.p, to) > 150)?.p; }
  else if (hits[0].p.kind === 'country') { from = hits[0].p; to = hits.find((h) => hav(h.p, from) > 150)?.p; }
  if (!from || !to) return null;
  const pick = (p) => ({ name: p.name.replace(/, Kuwait$/, ''), ar: p.ar || p.name, lat: p.lat, lon: p.lon });
  return { from: pick(from), to: pick(to) };
}
