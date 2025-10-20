const fs = require('fs');
const path = require('path');

// Load config
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// Helper to build Amazon links
function amazonSearch(q, tag) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`;
}

// Helper to get current UTC date parts
function parts() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return { y, m, day };
}

(function main() {
  const { y, m, day } = parts();

  // ✅ Read optional suffix from environment (set by manual workflow)
  const suffixRaw = process.env.SLUG_SUFFIX || '';
  const suffix = suffixRaw
    ? '-' + String(suffixRaw).trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    : '';

  // ✅ Build unique filename if suffix exists
  const filename = `${y}-${m}-${day}-golf-deals${suffix}.md`;
  const postsDir = path.join(__dirname, '_posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  // Front matter
  let md = `---\n`;
  md += `layout: post\n`;
  md += `title: "Daily Golf Deals — ${y}-${m}-${day}${suffix ? ' (' + suffix + ')' : ''}"\n`;
  md += `date: ${y}-${m}-${day} 07:00:00 +0000\n`;
  md += `categories: deals\n`;
  md += `---\n\n`;

  md += `Curated high-intent search links for golf gear. Some links may be monetized (Amazon Associates).\n\n`;

  // Generate sections
  for (const c of cfg.categories) {
    md += `## ${c.title}\n`;
    for (const term of c.terms) {
      const a = amazonSearch(term, cfg.amazonTag);
      md += `- **${term}** — [Amazon](${a})\n`;
    }
    md += `\n`;
  }

  // Write file
  fs.writeFileSync(path.join(postsDir, filename), md, 'utf8');
  console.log('📝 Wrote post:', filename);
})();