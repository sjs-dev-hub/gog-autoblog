const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

function amazonSearch(q, tag){
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`;
}
function parts(){
  const d = new Date(); const y=d.getUTCFullYear();
  const m=String(d.getUTCMonth()+1).padStart(2,'0');
  const day=String(d.getUTCDate()).padStart(2,'0');
  return { y, m, day };
}

(function main(){
  const { y, m, day } = parts();

  // ✅ NEW: optional unique suffix for manual runs
  const suffixRaw = process.env.SLUG_SUFFIX || '';
  const suffix = suffixRaw
    ? '-' + String(suffixRaw).trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    : '';

  const filename = `${y}-${m}-${day}-golf-deals${suffix}.md`;
  const postsDir = path.join(__dirname, '_posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  // Optional debug logs so you can see what's happening in Actions logs
  console.log('SLUG_SUFFIX seen by bot.js:', process.env.SLUG_SUFFIX || '(empty)');
  console.log('Output filename will be:', filename);

  let md = `---\nlayout: post\ntitle: "Daily Golf Deals — ${y}-${m}-${day}${suffix ? ' (' + suffix + ')' : ''}"\n`;
  md += `date: ${y}-${m}-${day} 07:00:00 +0000\ncategories: deals\n---\n\n`;
  md += `Curated high-intent search links for golf gear. Some links may be monetized (Amazon Associates).\n\n`;

  for (const c of cfg.categories) {
    md += `## ${c.title}\n`;
    for (const term of c.terms) {
      const a = amazonSearch(term, cfg.amazonTag);
      md += `- **${term}** — [Amazon](${a})\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(path.join(postsDir, filename), md, 'utf8');
  console.log('📝 Wrote post:', filename);
})();