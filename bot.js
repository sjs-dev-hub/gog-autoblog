const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

function amazonSearch(q, tag){
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`;
}
function parts(){
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return { y, m, day };
}

// Simple deterministic hash (so suffix -> stable rotation)
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

(function main(){
  const { y, m, day } = parts();

  // Optional suffix, used only for manual runs
  const suffixRaw = process.env.SLUG_SUFFIX || '';
  const suffix = suffixRaw
    ? '-' + String(suffixRaw).trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    : '';

  // How many items per category to output (default 5)
  const ITEMS = Number(cfg.itemsPerCategory || 5);

  const filename = `${y}-${m}-${day}-golf-deals${suffix}.md`;
  const postsDir = path.join(__dirname, '_posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  console.log('SLUG_SUFFIX seen by bot.js:', process.env.SLUG_SUFFIX || '(empty)');
  console.log('Output filename will be:', filename);

  // Title note for manual variants
  const variantNote = suffixRaw ? ` (variant: ${suffixRaw})` : '';

  let md = `---\n`;
  md += `layout: post\n`;
  md += `title: "Daily Golf Deals — ${y}-${m}-${day}${variantNote}"\n`;
  md += `date: ${y}-${m}-${day} 07:00:00 +0000\n`;
  md += `categories: deals\n`;
  md += `---\n\n`;

  md += `Curated high-intent search links for golf gear. Some links may be monetized (Amazon Associates).\n\n`;

  // For manual runs, rotate which terms we include per category
  // Rotation is based on the suffix so it’s deterministic per run
  for (const c of cfg.categories) {
    md += `## ${c.title}\n`;
    const terms = Array.from(c.terms || []);
    if (terms.length === 0) { md += `\n`; continue; }

    let startIdx = 0;
    if (suffixRaw) {
      // Different rotation per category name + suffix
      startIdx = hash(`${suffixRaw}::${c.title}`) % terms.length;
    }

    const n = Math.min(ITEMS, terms.length);
    for (let i = 0; i < n; i++) {
      const term = terms[(startIdx + i) % terms.length];
      const a = amazonSearch(term, cfg.amazonTag);
      md += `- **${term}** — [Amazon](${a})\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(path.join(postsDir, filename), md, 'utf8');
  console.log('📝 Wrote post:', filename);
})();