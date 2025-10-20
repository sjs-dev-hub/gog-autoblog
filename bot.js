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

// Simple deterministic hash for rotating content
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

(function main(){
  const { y, m, day } = parts();

  const suffixRaw = process.env.SLUG_SUFFIX || '';
  const suffix = suffixRaw
    ? '-' + String(suffixRaw).trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    : '';

  const baseName = `${y}-${m}-${day}-golf-deals${suffix}.md`;
  const postsDir = path.join(__dirname, '_posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  // Fallback: if filename exists, append a 4-char nonce
  let filename = baseName;
  const fullPath = (name) => path.join(postsDir, name);
  if (fs.existsSync(fullPath(filename))) {
    const nonce = Math.random().toString(36).slice(2, 6);
    filename = `${y}-${m}-${day}-golf-deals${suffix}-${nonce}.md`;
  }

  console.log('SLUG_SUFFIX seen by bot.js:', process.env.SLUG_SUFFIX || '(empty)');
  console.log('Output filename will be:', filename);

  const variantNote = suffixRaw ? ` (variant: ${suffixRaw})` : '';
  let md = `---\n`;
  md += `layout: post\n`;
  md += `title: "Daily Golf Deals — ${y}-${m}-${day}${variantNote}"\n`;
  md += `date: ${y}-${m}-${day} 07:00:00 +0000\n`;
  md += `categories: deals\n`;
  md += `---\n\n`;

  md += `Curated high-intent search links for golf gear. Some links may be monetized (Amazon Associates).\n\n`;

  // Rotate content when suffix present
  const ITEMS = Number(cfg.itemsPerCategory || 5);
  for (const c of cfg.categories) {
    md += `## ${c.title}\n`;
    const terms = Array.from(c.terms || []);
    if (!terms.length) { md += `\n`; continue; }

    let startIdx = 0;
    if (suffixRaw) startIdx = hash(`${suffixRaw}::${c.title}`) % terms.length;

    const n = Math.min(ITEMS, terms.length);
    for (let i = 0; i < n; i++) {
      const term = terms[(startIdx + i) % terms.length];
      md += `- **${term}** — [Amazon](${amazonSearch(term, cfg.amazonTag)})\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(fullPath(filename), md, 'utf8');
  console.log('📝 Wrote post:', filename);
})();