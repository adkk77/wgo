# WGO: live news map centred on Kuwait

WGO fetches news from trusted Arabic and English outlets every 5 minutes. It sorts each story into one of five categories (financial, political, war, crises, crime) and places it on a world map centred on Kuwait City. Every story sits at its real distance and direction from Kuwait. The page opens in Arabic, and a button switches it to English.

خريطة أخبار مباشرة مركزها الكويت. يجمع الخادم الأخبار من مصادر عربية وإنجليزية موثوقة كل ٥ دقائق، ويصنّفها (اقتصاد، سياسة، حرب، أزمات، جريمة)، ويضع كل خبر على الخريطة حسب بعده واتجاهه عن الكويت. الواجهة بالعربية افتراضياً مع زر للتبديل إلى الإنجليزية.

## Run it on your computer

You need Node.js 20 or newer. The server has no packages to install.

```
npm start
```

Then open http://localhost:3000. The first stories appear within a few seconds.

To check everything works without the internet, using the sample feeds in `test/fixtures`:

```
npm test
```

## Put it online

Any host that runs Node.js or Docker will work. Two simple options:

- **Render** (free to start): push this folder to a GitHub repo. In Render, choose New → Blueprint and pick the repo. `render.yaml` sets everything up. On the free plan the server sleeps after 15 minutes with no visitors. It wakes when someone opens the page and fetches fresh news straight away, so the first load after a quiet spell takes about 30 seconds.
- **Railway, Fly.io or a small VPS** (about US$5 a month): these stay awake, so the news keeps refreshing every 5 minutes even with no visitors. Use the `Dockerfile`.

## Settings

| Variable | Default | What it does |
|---|---|---|
| `PORT` | 3000 | Port the server listens on |
| `REFRESH_MINUTES` | 5 | How often feeds are fetched |
| `MAX_AGE_HOURS` | 48 | Stories older than this drop off the map |
| `MAX_STORIES` | 500 | Most stories kept at once |
| `FEEDS_FILE` | feeds.json | Which list of sources to use |

## Sources

Sources are listed in `feeds.json`. Each entry has a name in English and Arabic, a language (`ar` or `en`), and a feed URL. `kuwaitLocal: true` marks Kuwaiti outlets, so their stories default to Kuwait when no other place is named.

Reuters, AP, KUNA, Al Arabiya, Sky News Arabia, Al Qabas and Al Rai don't publish open RSS feeds. For those, the server reads Google News' public RSS search, limited to that outlet's website and the last day. Each story still links to the outlet's own article. If one of these outlets offers a direct feed or an API, put its URL in `feeds.json` instead.

If a feed fails, the others carry on. The page footer crosses out any source that couldn't be reached on the last refresh.

## How stories are sorted and placed

- **Category** (`lib/classify.js`): keyword scoring in Arabic and English. Words in the headline count double. Sport and entertainment are dropped. To change how stories are sorted, edit the word lists.
- **Place** (`lib/geo.js`, `data/places.json`): about 350 countries, cities, regions, waterways and Kuwaiti areas, each with English and Arabic names. A specific place beats a country, so "Hormuz" beats "Iran". A country named only as an adjective ("the Italian minister") doesn't move a Kuwaiti story abroad. Stories with no recognisable place are left off the map.
- **Distance and direction**: great-circle distance and starting bearing from Kuwait City (29.3759° N, 47.9783° E).

## API

`GET /api/stories?lang=ar|en|all` returns `{ updated, sources, stories }`. Each story has `title`, `summary`, `url`, `source`, `published`, `category`, `place {name, ar, lat, lon}`, `km` and `bearing`. A phone app can be built on this same endpoint later.
