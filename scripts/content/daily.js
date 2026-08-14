'use strict';

const fs = require('fs');
const path = require('path');
const { generateArticle } = require('./openai');
const { articleText, similarity, validateArticle } = require('../prototype/quality');
const { renderArticle } = require('../prototype/render');
const { generateArticleImage } = require('./image');

const root = path.resolve(__dirname, '..', '..');
const postsDir = path.join(root, '_posts');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const topics = JSON.parse(fs.readFileSync(path.join(__dirname, 'topic-plan.json'), 'utf8'));

function utcDate() { return new Date().toISOString().slice(0, 10); }
function slugify(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); }
function hash(value) { let result = 2166136261; for (const char of value) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619); } return result >>> 0; }

function recentPosts(limit = 90) {
  return fs.readdirSync(postsDir).filter(name => name.endsWith('.md')).sort().slice(-limit)
    .map(name => ({ name, text: fs.readFileSync(path.join(postsDir, name), 'utf8') }));
}

function chooseTopic(date, recent) {
  const start = hash(date) % topics.length;
  for (let offset = 0; offset < topics.length; offset += 1) {
    const topic = topics[(start + offset) % topics.length];
    const repeated = recent.some(post => similarity(topic.topic, post.text.slice(0, 1200)) >= 0.5);
    if (!repeated) return topic;
  }
  throw new Error('No sufficiently distinct topic is available; refusing to publish a duplicate');
}

(async () => {
  const date = process.env.PUBLISH_DATE || utcDate();
  const existingToday = fs.readdirSync(postsDir).filter(name => name.startsWith(`${date}-`));
  if (existingToday.length) {
    console.log(`A post already exists for ${date}; no duplicate will be generated.`);
    return;
  }
  const recent = recentPosts();
  const brief = chooseTopic(date, recent);
  const article = await generateArticle({ ...brief, publicationDate: date, affiliateTag: config.amazonTag });
  const errors = validateArticle(article, recent.map(post => post.text));
  const allowedSources = new Set(brief.evidence.map(source => source.url));
  for (const source of article.sources || []) if (!allowedSources.has(source.url)) errors.push(`unapproved source URL: ${source.url}`);
  if (article.articleType !== brief.articleType) errors.push(`article type changed from ${brief.articleType} to ${article.articleType}`);
  if (errors.length) throw new Error(`Generated article failed quality checks:\n- ${errors.join('\n- ')}`);

  const slug = slugify(article.title);
  const outputPath = path.join(postsDir, `${date}-${slug}.md`);
  if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite ${path.basename(outputPath)}`);
  const heroImage = process.env.GENERATE_ARTICLE_IMAGE === '0' ? null : await generateArticleImage(article, date, slug);
  fs.writeFileSync(outputPath, renderArticle(article, date, slug, config.amazonTag, { prototype: false, heroImage }), 'utf8');
  console.log(`Wrote validated daily article: ${path.relative(root, outputPath)}`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
