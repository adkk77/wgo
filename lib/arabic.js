// Arabic text helpers: normalise spelling variants so matching is forgiving.
export function normAr(s = '') {
  return s
    .replace(/[ً-ْٰـ]/g, '') // harakat, dagger alif, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const B = '(?:^|[\\s\\p{P}\\p{S}])'; // left boundary
const E = '(?=$|[\\s\\p{P}\\p{S}])'; // right boundary
const SUFFIX = '(?:يه|ي|يين|يون|يا|ين|ون|ه)?'; // demonym / plural endings after normalisation

// Build a regex that finds an Arabic word with the usual attached prefixes
// (و ف ب ل ك and the article ال) and demonym suffixes.
export function arPattern(alias) {
  const a = normAr(alias).trim();
  const words = a.split(/\s+/);
  const first = words[0];
  let head;
  if (first.startsWith('ال')) {
    const stem = esc(first.slice(2));
    head = `(?:[وف]?(?:[بك]?ال|لل))${stem}`;
  } else {
    head = `[وف]?[بلك]?(?:ال)?${esc(first)}`;
  }
  const rest = words.slice(1).map(esc).join('\\s+');
  const body = rest ? `${head}\\s+${rest}` : head;
  return new RegExp(`${B}(${body}${SUFFIX})${E}`, 'u');
}

export function enPattern(alias) {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(${esc(alias)})(?:'s)?(?=$|[^\\p{L}\\p{N}])`, alias === alias.toUpperCase() ? 'u' : 'iu');
}
