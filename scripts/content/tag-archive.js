'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const postsDir = path.join(root, '_posts');
const taxonomy = [
  { name: 'Putting', terms: ['putt', 'putter', 'putting', 'green-reading'] },
  { name: 'Driving', terms: ['driver', 'driving', 'tee-shot', 'draw-bias', 'high-moi'] },
  { name: 'Wedges & Short Game', terms: ['wedge', 'chipping', 'pitching', 'short-game', 'sand-wedge', 'lob-wedge'] },
  { name: 'Irons', terms: ['iron', 'irons', 'hollow-body', 'players-distance', 'game-improvement-iron'] },
  { name: 'Golf Balls', terms: ['golf-ball', 'golf-balls', 'pro-v1', 'two-piece', 'three-piece'] },
  { name: 'Practice & Training', terms: ['practice', 'trainer', 'training', 'alignment-stick', 'impact-bag', 'swing-analyzer', 'tempo'] },
  { name: 'Technology', terms: ['launch-monitor', 'rangefinder', 'gps', 'sensor', 'technology', 'tech'] },
  { name: 'Bags & Accessories', terms: ['golf-bag', 'stand-bag', 'cart-bag', 'glove', 'towel', 'accessory', 'accessories'] }
];

function classify(filename, frontMatter) {
  const title = (frontMatter.match(/^title:\s*["']?(.*?)["']?\s*$/m) || [])[1] || '';
  const haystack = `${filename.slice(11, -3)} ${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const topics = taxonomy.filter(group => group.terms.some(term => haystack.includes(term))).map(group => group.name);
  return topics.length ? topics : ['General Gear'];
}

let changed = 0;
const counts = new Map();
for (const filename of fs.readdirSync(postsDir).filter(name => name.endsWith('.md'))) {
  const postPath = path.join(postsDir, filename);
  const source = fs.readFileSync(postPath, 'utf8');
  const match = source.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/);
  if (!match) throw new Error(`Missing front matter: ${filename}`);
  const topics = classify(filename, match[2]);
  topics.forEach(topic => counts.set(topic, (counts.get(topic) || 0) + 1));
  const topicLine = `topics: [${topics.map(topic => JSON.stringify(topic)).join(', ')}]`;
  const updatedFrontMatter = /^topics:/m.test(match[2])
    ? match[2].replace(/^topics:.*$/m, topicLine)
    : `${match[2].replace(/\s+$/, '')}\n${topicLine}`;
  const updated = source.replace(match[0], `${match[1]}${updatedFrontMatter}${match[3]}`);
  if (updated !== source) {
    fs.writeFileSync(postPath, updated, 'utf8');
    changed += 1;
  }
}

console.log(`Tagged ${changed} posts.`);
for (const [topic, count] of [...counts.entries()].sort()) console.log(`${topic}: ${count}`);
