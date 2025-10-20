const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

function amazonSearch(q, tag) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`;
}

function dateParts() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return { y, m, day, hh, mm };
}

// simple deterministic hash → integer
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
    // LCG-ish step
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

(function main () {
  const { y, m, day, hh, mm } = dateParts();

  // suffix only set by the manual workflow
  const suffixRaw = process.env.SLUG_SUFFIX || '';
  const suffix = suffixRaw ? '-' + String(suffixRaw).trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : '';

  const postsDir = path.join(__dirname, '_posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  // ----- filename (unique when suffix present)
  let filename = `${y}-${m}-${day}-golf-deals${suffix}.md`;
  const full = (name) => path.join(postsDir, name);
  if (fs.existsSync(full(filename))) {
    const nonce = Math.random().toString(36).slice(2, 6);
    filename = `${y}-${m}-${day}-golf-deals${suffix}-${nonce}.md`;
  }

  // ----- front-matter date
  // daily run (no suffix) keeps 07:00; manual run uses "now" so it's not future-dated
  const fmTime = suffixRaw ? `${y}-${m}-${day} ${hh}:${mm}:00 +0000`
                           : `${y}-${m}-${day} 07:00:00 +0000`;

  // ----- title note for manual variant (cosmetic)
  const variantNote = suffixRaw ? ` (variant: ${suffixRaw})` : '';

  console.log('SLUG_SUFFIX seen by bot.js:', process.env.SLUG_SUFFIX || '(empty)');
  console.log('Output filename will be:', filename);

  let md = `---\n`;
  md += `layout: post\n`;
  md += `title: "Daily Golf Deals — ${y}-${m}-${day}${variantNote}"\n`;
  md += `date: ${fmTime}\n`;
  md += `categories: deals\n`;
  md += `---\n\n`;

  md += `Curated high-intent search links for golf gear. Some links may be monetized (Amazon Associates).\n\n`;

  // How many items max per category (from config, default 5)
  const MAX_ITEMS = Number(cfg.itemsPerCategory || 5);

  // For manual runs, pick a deterministic subset via the suffix
  for (const c of cfg.categories) {
    const all = Array.from(c.terms || []);
    if (!all.length) continue;

    let chosen = all;
    if (suffixRaw) {
      // Shuffle deterministically by seed (suffix + category)
      const seed = hash(`${suffixRaw}::${c.title}`);
      const shuffled = seededShuffle(all, seed);
      // choose fewer than full set so content differs:
      const take = Math.max(1, Math.min(MAX_ITEMS, Math.ceil(all.length * 0.6)));
      chosen = shuffled.slice(0, take);
    } else {
      // daily: keep your original behavior up to MAX_ITEMS
      chosen = all.slice(0, Math.min(MAX_ITEMS, all.length));
    }

    md += `## ${c.title}\n`;
    for (const term of chosen) {
      md += `- **${term}** — [Amazon](${amazonSearch(term, cfg.amazonTag)})\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(full(filename), md, 'utf8');
  console.log('📝 Wrote post:', filename);
})();