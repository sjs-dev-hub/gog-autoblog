'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const postsDir = path.join(root, '_posts');
const outputDir = path.join(root, '_prototype');
const genericPatterns = [
  /elevate your game/gi,
  /without breaking the bank/gi,
  /unbeatable value/gi,
  /when shopping for/gi,
  /common mistakes include/gi,
  /sample product types/gi,
  /guild of golf[^\n]{0,20}daily deals/gi
];

function bodyOf(text) { return text.replace(/^---[\s\S]*?---\s*/, ''); }
function words(text) { return (text.toLowerCase().match(/[a-z0-9]+/g) || []); }
function shingles(text, size = 5) {
  const tokens = words(text);
  const result = new Set();
  for (let index = 0; index <= tokens.length - size; index += 1) result.add(tokens.slice(index, index + size).join(' '));
  return result;
}
function similarity(left, right) {
  let shared = 0;
  for (const item of left) if (right.has(item)) shared += 1;
  return shared / Math.max(1, Math.min(left.size, right.size));
}
function countMatches(text, pattern) { return (text.match(pattern) || []).length; }

const posts = fs.readdirSync(postsDir).filter(name => name.endsWith('.md')).sort().map(name => {
  const text = fs.readFileSync(path.join(postsDir, name), 'utf8');
  const body = bodyOf(text);
  return {
    name,
    body,
    wordCount: words(body).length,
    genericHits: genericPatterns.reduce((sum, pattern) => sum + countMatches(body, pattern), 0),
    malformedMarkers: countMatches(body, /^\*\*\s*$/gm),
    shingles: shingles(body)
  };
});

for (let left = 0; left < posts.length; left += 1) {
  posts[left].closestDuplicate = { name: null, score: 0 };
  for (let right = 0; right < posts.length; right += 1) {
    if (left === right) continue;
    const score = similarity(posts[left].shingles, posts[right].shingles);
    if (score > posts[left].closestDuplicate.score) posts[left].closestDuplicate = { name: posts[right].name, score };
  }
  posts[left].riskScore = posts[left].genericHits * 8 + posts[left].malformedMarkers * 3 + Math.round(posts[left].closestDuplicate.score * 50);
}

const ranked = posts.slice().sort((a, b) => b.riskScore - a.riskScore || b.closestDuplicate.score - a.closestDuplicate.score);
const candidates = ranked.filter(post => !post.name.startsWith('2026-08-')).slice(0, 10);
const report = {
  generatedAt: new Date().toISOString(),
  methodology: 'Repository-only content analysis. Search traffic and revenue were not available, so this does not classify SEO performance.',
  totals: {
    posts: posts.length,
    postsWithGenericLanguage: posts.filter(post => post.genericHits > 0).length,
    postsWithMalformedMarkers: posts.filter(post => post.malformedMarkers > 0).length,
    postsWithVeryHighSimilarity: posts.filter(post => post.closestDuplicate.score >= 0.8).length
  },
  pilotCandidates: candidates.map(({ name, wordCount, genericHits, malformedMarkers, closestDuplicate, riskScore }) => ({ name, wordCount, genericHits, malformedMarkers, closestDuplicate, riskScore }))
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'content-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
const rows = candidates.slice(0, 5).map((post, index) => `${index + 1}. \`${post.name}\` — score ${post.riskScore}; ${post.genericHits} generic phrases; ${post.malformedMarkers} malformed markers; closest duplicate \`${post.closestDuplicate.name}\` (${Math.round(post.closestDuplicate.score * 100)}%).`).join('\n');
fs.writeFileSync(path.join(outputDir, 'content-audit.md'), `# Existing-content pilot audit\n\nGenerated ${report.generatedAt}. This is a repository-content audit, not a Search Console performance report. Existing URLs and dates remain untouched.\n\n## Inventory\n\n- Posts analyzed: ${report.totals.posts}\n- Posts containing tracked generic language: ${report.totals.postsWithGenericLanguage}\n- Posts containing malformed standalone Markdown markers: ${report.totals.postsWithMalformedMarkers}\n- Posts at least 80% similar to another post by five-word shingles: ${report.totals.postsWithVeryHighSimilarity}\n\n## First five draft-only candidates\n\n${rows}\n\n## Approval gate\n\nBefore any in-place rewrite, combine this list with Google Search Console clicks, impressions, position, and conversion data. Exclude pages with meaningful traffic or revenue from the first pilot.\n`);
console.log(`Analyzed ${posts.length} posts; wrote _prototype/content-audit.json and .md`);
