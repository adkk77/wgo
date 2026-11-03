// Keyword scoring into the five WGO categories. Returns null for stories
// that fit none of them (sport, entertainment, lifestyle), which are dropped.
import { normAr, arPattern, enPattern } from './arabic.js';

const WORDS = {
  war: {
    en: ['war', 'airstrike', 'airstrikes', 'air strike', 'strikes on', 'strikes', 'missile', 'missiles', 'drone', 'drones', 'shelling', 'bombing', 'bombs', 'troops', 'army', 'military', 'militants', 'offensive', 'ceasefire', 'truce', 'invasion', 'frontline', 'front line', 'fighting', 'clashes', 'killed in', 'soldiers', 'navy', 'warship', 'rebels', 'insurgents', 'Houthi', 'Houthis', 'Hezbollah', 'Hamas', 'IDF', 'artillery', 'attack on', 'attacked', 'attacks', 'tanker', 'blockade'],
    ar: ['حرب', 'الحرب', 'غاره', 'غارات', 'قصف', 'صاروخ', 'صواريخ', 'مسيره', 'مسيرات', 'هجوم', 'هجمات', 'اشتباك', 'اشتباكات', 'جيش', 'عسكري', 'القوات', 'معارك', 'قتلي', 'قتيل', 'اجتياح', 'هدنه', 'وقف اطلاق النار', 'ضربه', 'ضربات', 'مقاتلات', 'الحوثي', 'المقاومه', 'توغل', 'جنود', 'الفصائل'],
    w: 2.5,
  },
  crisis: {
    en: ['earthquake', 'flood', 'floods', 'flooding', 'storm', 'hurricane', 'cyclone', 'typhoon', 'wildfire', 'fire', 'drought', 'famine', 'outbreak', 'epidemic', 'pandemic', 'cholera', 'refugees', 'displaced', 'humanitarian', 'aid', 'disaster', 'collapse', 'crash', 'accident', 'evacuate', 'evacuation', 'shortage', 'blackout', 'heatwave', 'rescue', 'emergency', 'sinks', 'capsized'],
    ar: ['زلزال', 'فيضان', 'فيضانات', 'سيول', 'اعصار', 'حريق', 'حرائق', 'جفاف', 'مجاعه', 'وباء', 'الكوليرا', 'لاجيين', 'نازحين', 'النازحين', 'اغاثه', 'انسانيه', 'كارثه', 'انهيار', 'حادث', 'تصادم', 'غرق', 'عاصفه', 'امطار', 'اخلاء', 'نقص', 'انقطاع الكهرباء', 'طوارئ', 'انقاذ'],
    w: 2.5,
  },
  crime: {
    en: ['arrested', 'arrest', 'police', 'murder', 'killed by', 'shooting', 'gunmen', 'robbery', 'theft', 'fraud', 'scam', 'smuggling', 'drugs', 'trafficking', 'court', 'trial', 'sentenced', 'convicted', 'charged', 'prosecutor', 'prison', 'jail', 'corruption', 'bribery', 'money laundering', 'hack', 'hacked', 'cyberattack', 'cyberattacks', 'kidnapped', 'stabbing', 'seized', 'seize', 'seizes', 'customs', 'smuggled', 'judge', 'money-laundering', 'concealment', 'fines', 'enforcement', 'FBI', 'pardon'],
    ar: ['القبض', 'ضبط', 'اعتقال', 'جريمه', 'قتل', 'سرقه', 'احتيال', 'نصب', 'مخدرات', 'تهريب', 'محكمه', 'حكم', 'سجن', 'متهم', 'النيابه', 'الشرطه', 'الامن', 'اختلاس', 'غسل الاموال', 'فساد', 'اختراق', 'قرصنه', 'خطف', 'طعن', 'مضبوطات', 'الجنايات', 'التمييز', 'تضبط', 'يضبط', 'جمارك', 'المهرب', 'المحكمه العليا', 'القضاء'],
    w: 2.5,
  },
  financial: {
    en: ['economy', 'economic', 'oil', 'crude', 'production', 'output', 'Brent', 'barrel', 'prices', 'stocks', 'shares', 'markets', 'market', 'bank', 'central bank', 'budget', 'inflation', 'interest rate', 'rates', 'investment', 'investors', 'dinar', 'dollar', 'profit', 'earnings', 'company', 'exports', 'trade', 'tariff', 'tariffs', 'tax', 'OPEC', 'deposits', 'GDP', 'fees', 'airlines', 'LNG', 'gas', 'bonds', 'IPO', 'Wall Street', 'bourse', 'currency', 'deal worth', 'billion'],
    ar: ['اقتصاد', 'الاقتصاد', 'اقتصادي', 'نفط', 'النفط', 'انتاج', 'برميل', 'خام', 'اسعار', 'اسهم', 'بورصه', 'البورصه', 'سوق', 'اسواق', 'بنك', 'البنك المركزي', 'ميزانيه', 'تضخم', 'الفايده', 'استثمار', 'الدينار', 'الدولار', 'ارباح', 'شركه', 'صادرات', 'تجاره', 'تجاري', 'ضريبه', 'رسوم', 'اوبك', 'ودايع', 'تمويل', 'عملات', 'مليار', 'المناقصات', 'الناتج المحلي'],
    w: 2,
  },
  political: {
    en: ['president', 'prime minister', 'minister', 'government', 'parliament', 'election', 'elections', 'vote', 'summit', 'talks', 'diplomat', 'diplomatic', 'ambassador', 'emir', 'crown prince', 'king', 'agreement', 'negotiations', 'United Nations', 'Security Council', 'sanctions', 'policy', 'cabinet', 'opposition', 'protest', 'protests', 'senate', 'congress', 'midterms', 'treaty', 'envoy', 'visit', 'visits', 'meets', 'partnership', 'delegation', 'demands', 'ministry', 'strategic plan', 'regulator', 'reforms', 'mediates', 'mediation'],
    ar: ['رييس', 'الرييس', 'وزير', 'الوزراء', 'حكومه', 'الحكومه', 'برلمان', 'مجلس الامه', 'انتخابات', 'قمه', 'مباحثات', 'محادثات', 'دبلوماسي', 'سفير', 'امير', 'ولي العهد', 'اتفاق', 'مفاوضات', 'الامم المتحده', 'مجلس الامن', 'عقوبات', 'مجلس الوزراء', 'المعارضه', 'احتجاجات', 'تظاهرات', 'زياره', 'يستقبل', 'استقبل', 'شراكه', 'مبعوث', 'الخارجيه', 'العلاقات الثنائيه', 'وزاره', 'وفد', 'مطالب', 'وساطه', 'خطه', 'قرار'],
    w: 1,
  },
};

const SKIP = {
  en: ['football', 'soccer', 'match', 'league', 'cup', 'tennis', 'cricket', 'Formula 1', 'F1', 'NBA', 'goal', 'film', 'movie', 'celebrity', 'recipe', 'fashion', 'album', 'concert', 'Oscars', 'horoscope'],
  ar: ['كره القدم', 'مباراه', 'الدوري', 'كاس', 'منتخب', 'لاعب', 'نادي', 'فيلم', 'مسلسل', 'فنان', 'فنانه', 'حفل', 'ازياء', 'وصفه', 'الابراج'],
};

const compiled = {};
for (const [cat, d] of Object.entries(WORDS)) {
  compiled[cat] = { w: d.w, en: d.en.map(enPattern), ar: d.ar.map(arPattern) };
}
const skipC = { en: SKIP.en.map(enPattern), ar: SKIP.ar.map(arPattern) };

function score(patterns, text) {
  let n = 0;
  for (const p of patterns) if (p.test(text)) n++;
  return n;
}

export function classify(title, description, lang) {
  const t = lang === 'ar' ? normAr(title) : title;
  const d = lang === 'ar' ? normAr(description) : description;
  const best = { cat: null, s: 0 };
  for (const [cat, c] of Object.entries(compiled)) {
    const pats = c[lang] || c.en;
    // the headline counts twice as much as the summary
    const s = (score(pats, t) * 2 + score(pats, d)) * c.w;
    if (s > best.s) { best.cat = cat; best.s = s; }
  }
  const skip = score(skipC[lang] || skipC.en, t) * 2 + score(skipC[lang] || skipC.en, d);
  if (skip >= 2 && skip * 2 >= best.s) return null;
  return best.s >= 2 ? best.cat : null;
}
