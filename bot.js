const fs = require('fs');
const path = require('path');

// ---- Load config ------------------------------------------------------------
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// ---- Utilities --------------------------------------------------------------
function amazonSearch(q, tag) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`;
}

function utcParts(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return { y, m, day, hh, mm };
}

// simple deterministic hash -> non-negative int
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

// deterministic shuffle based on a seed
function seededShuffle(arr, seed) {
  const out = arr.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function humanize(term) {
  let t = String(term).trim();
  t = t.replace(/\s*\$\s*/g, ' $');     // "$300" -> " $300"
  t = t.replace(/\bpro v1\b/gi, 'Pro V1');
  return t;
}

// build a short, descriptive slug from a list of terms
function toSlug(s) {
  return String(s)
    .toLowerCase()
    .replace(/\s*\$\s*/g, '')          // remove $ spacing
    .replace(/[^a-z0-9]+/g, '-')       // non-alnum -> hyphen
    .replace(/-+/g, '-')               // collapse hyphens
    .replace(/^-|-$/g, '');            // trim hyphens
}

function uniqueSlugFromTerms(terms, maxWords = 8, maxLen = 60) {
  // pick the first N distinct "keywordish" terms, slugify, truncate length
  const seen = new Set();
  const parts = [];
  for (const t of terms) {
    const s = toSlug(t);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    parts.push(s);
    if (parts.length >= maxWords) break;
  }
  let slug = parts.join('-');
  if (slug.length > maxLen) slug = slug.slice(0, maxLen).replace(/-+[^-]*$/, ''); // cut cleanly
  return slug || 'golf-deals';
}

// ---- Main -------------------------------------------------------------------
(function main() {
  const now = new Date();
  const { y, m, day, hh, mm } = utcParts(now);
  const dateKey = `${y}-${m}-${day}`;

  // Optional suffix set by manual workflow (only affects variety/selection)
  const suffixRaw = process.env.SLUG_SUFFIX || '';
  const seed = hash(`${dateKey}::${suffixRaw || 'daily'}`);

  // How many items to show per category
  const MAX_ITEMS = Number(cfg.itemsPerCategory || 5);

  // Choose items per category (manual picks a deterministic subset; daily keeps order)
  const chosenByCat = [];
  for (const c of cfg.categories) {
    const terms = Array.from(c.terms || []);
    if (!terms.length) { chosenByCat.push({ title: c.title, items: [] }); continue; }

    if (suffixRaw) {
      const s = hash(`${suffixRaw}::${c.title}`);
      const shuffled = seededShuffle(terms, s);
      const take = Math.max(2, Math.min(MAX_ITEMS, Math.ceil(terms.length * 0.6)));
      chosenByCat.push({ title: c.title, items: shuffled.slice(0, take) });
    } else {
      chosenByCat.push({ title: c.title, items: terms.slice(0, Math.min(MAX_ITEMS, terms.length)) });
    }
  }

  // Build a descriptive slug from the first few chosen terms across categories
  const flatChosen = chosenByCat.flatMap(x => x.items);
  const descriptive = uniqueSlugFromTerms(flatChosen, 6, 64); // ~6 keyword chunks
  const baseSlug = descriptive ? `golf-deals-${descriptive}` : 'golf-deals';

  // Where to write
  const postsDir = path.join(__dirname, '_posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  // Filename (never puts the "variant" text in the URL)
  let filename = `${y}-${m}-${day}-${baseSlug}.md`;
  const full = (name) => path.join(postsDir, name);
  if (fs.existsSync(full(filename))) {
    const nonce = Math.random().toString(36).slice(2, 6);
    filename = `${y}-${m}-${day}-${baseSlug}-${nonce}.md`;
  }

  // Front-matter date:
  // - daily (no suffix): fixed 07:00 UTC so tomorrow’s post appears at 07:00
  // - manual (suffix present): current UTC time so it publishes immediately
  const fmTime = suffixRaw ? `${y}-${m}-${day} ${hh}:${mm}:00 +0000`
                           : `${y}-${m}-${day} 07:00:00 +0000`;

  // Title (clean, friendly — no "(variant: ...)")
  const leadTerms = flatChosen.slice(0, 3).map(humanize);
  const titleTail = leadTerms.length ? `: ${leadTerms.join(', ')}` : '';
  const title = `${cfg.siteTitle || 'Daily Golf Deals'} — ${dateKey}${titleTail}`;

  console.log('SLUG_SUFFIX seen by bot.js:', process.env.SLUG_SUFFIX || '(empty)');
  console.log('Output filename will be:', filename);

  // ---- Write Markdown -------------------------------------------------------
  let md = `---\n`;
  md += `layout: post\n`;
  md += `title: "${title}"\n`;
  md += `date: ${fmTime}\n`;
  md += `categories: deals\n`;
  md += `---\n\n`;

  // Intro & transition
  const introTemplates = [
    `Looking to upgrade your golf gear without overspending? Below are today’s curated picks—useful searches that surface strong value across popular categories.`,
    `New day, new deals. We’ve rounded up practical search links to help you compare prices and spot value quickly.`,
    `If you’re bargain-hunting for golf equipment, start here. These targeted searches make it easy to scan options and pricing fast.`
  ];
  const transitions = [
    `Here’s what we’re tracking today:`,
    `Start your search with these categories:`,
    `Below are the most requested categories right now:`
  ];
  md += `${introTemplates[seed % introTemplates.length]} ${transitions[(seed + 7) % transitions.length]}\n\n`;

  // Per-category mini-paragraph + bullets
  const leadIns = [
    (t) => `**${t}.** A quick way to scan current options and pricing:`,
    (t) => `**${t}.** Good starting points when you’re comparing choices:`,
    (t) => `**${t}.** Useful filters if you’re time-boxed:`
  ];

  for (let i = 0; i < chosenByCat.length; i++) {
    const { title: catTitle, items } = chosenByCat[i];
    if (!items.length) continue;

    md += `${leadIns[(seed + i) % leadIns.length](catTitle)}\n\n`;
    for (const term of items) {
      const label = humanize(term);
      md += `- **${label}** — [Amazon](${amazonSearch(term, cfg.amazonTag)})\n`;
    }
    md += `\n`;
  }

  // Outro / disclosure
  const outros = [
    `We update these picks automatically. If you find a better option, tell us and we’ll refine the searches. Some links may be monetized (Amazon Associates).`,
    `Bookmark this page—fresh picks post automatically. Some links may be monetized (Amazon Associates).`
  ];
  md += `${outros[(seed + 13) % outros.length]}\n`;

  fs.writeFileSync(full(filename), md, 'utf8');
  console.log('📝 Wrote post:', filename);
})();