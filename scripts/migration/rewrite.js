'use strict';

const fs = require('fs');
const path = require('path');
const { generateArticle } = require('../content/openai');
const { validateArticle } = require('../prototype/quality');
const { renderArticle } = require('../prototype/render');

const root = path.resolve(__dirname, '..', '..');
const postsDir = path.join(root, '_posts');
const outputDir = path.join(root, '_drafts', 'rewrites');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const topicPlan = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'content', 'topic-plan.json'), 'utf8'));
const defaultTargets = JSON.parse(fs.readFileSync(path.join(__dirname, 'pilot-targets.json'), 'utf8'));

function bodyOf(text) { return text.replace(/^---[\s\S]*?---\s*/, ''); }
function titleOf(text, filename) {
  const match = text.match(/^title:\s*["']?(.*?)["']?\s*$/m);
  return match ? match[1] : filename.slice(11, -3).replace(/-/g, ' ');
}
function scoreBrief(filename, brief) {
  const haystack = `${filename} ${brief.topic}`.toLowerCase();
  return brief.topic.toLowerCase().split(/\W+/).filter(word => word.length > 4 && haystack.includes(word)).length;
}
function chooseBrief(filename) {
  return topicPlan.slice().sort((a, b) => scoreBrief(filename, b) - scoreBrief(filename, a))[0];
}
function parseTargets() {
  const targetIndex = process.argv.indexOf('--target');
  return targetIndex >= 0 ? [process.argv[targetIndex + 1]] : defaultTargets;
}

async function generateValidatedRewrite(brief, filename) {
  let revision = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const article = await generateArticle(revision ? { ...brief, revision } : brief);
    const errors = validateArticle(article);
    if (!errors.length) return article;
    console.warn(`${filename} attempt ${attempt} rejected by ${errors.length} quality check(s)`);
    revision = {
      instruction: 'Revise the complete draft to correct every listed quality error. Preserve all valid evidence boundaries and return a complete replacement JSON article.',
      qualityErrors: errors,
      rejectedDraft: article
    };
  }
  throw new Error(`${filename} failed quality checks after two OpenAI passes`);
}

(async () => {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required; no fallback rewrite will be created');
  fs.mkdirSync(outputDir, { recursive: true });
  for (const filename of parseTargets()) {
    if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(filename)) throw new Error(`Invalid target filename: ${filename}`);
    const sourcePath = path.join(postsDir, filename);
    if (!fs.existsSync(sourcePath)) throw new Error(`Target does not exist: ${filename}`);
    const source = fs.readFileSync(sourcePath, 'utf8');
    const brief = chooseBrief(filename);
    const date = filename.slice(0, 10);
    const slug = filename.slice(11, -3);
    const articleBrief = {
      ...brief,
      publicationDate: date,
      affiliateTag: config.amazonTag,
      migration: {
        originalTitle: titleOf(source, filename),
        originalContent: bodyOf(source).slice(0, 18000),
        constraints: [
          'Rewrite from first principles; do not preserve repetitive boilerplate or malformed Markdown.',
          'Preserve the original URL topic and publication date.',
          'Do not claim current pricing, availability, hands-on testing, or personal experience.',
          'Teach a useful decision process before presenting shopping options.'
        ]
      }
    };
    const article = await generateValidatedRewrite(articleBrief, filename);
    let rendered = renderArticle(article, date, slug, config.amazonTag, { prototype: false });
    rendered = rendered.replace('categories: deals\n', `categories: deals\nmigration_target: "_posts/${filename}"\noriginal_url_preserved: true\n`);
    fs.writeFileSync(path.join(outputDir, filename), rendered, 'utf8');
    console.log(`Drafted rewrite: ${filename}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
