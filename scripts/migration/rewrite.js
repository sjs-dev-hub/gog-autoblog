'use strict';

const fs = require('fs');
const path = require('path');
const { generateArticle } = require('../content/openai');
const { articleText, validateArticle } = require('../prototype/quality');
const { renderArticle } = require('../prototype/render');

const root = path.resolve(__dirname, '..', '..');
const postsDir = path.join(root, '_posts');
const outputDir = path.join(root, '_drafts', 'rewrites');
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const topicPlan = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'content', 'topic-plan.json'), 'utf8'));
const defaultTargets = JSON.parse(fs.readFileSync(path.join(__dirname, 'pilot-targets.json'), 'utf8'));
const rewriteAngles = [
  'Choose among setup, ball-roll, and motion feedback based on the miss the golfer can actually observe.',
  'Build a compact home-practice station for a golfer with limited floor space and short practice windows.',
  'Create a progressive practice routine that changes tools only after a measurable success signal.',
  'Explain which measurements are useful, which are distractions, and when simple visual feedback is enough.',
  'Help an improving golfer decide the order in which to add practice tools instead of buying several at once.'
];

function bodyOf(text) { return text.replace(/^---[\s\S]*?---\s*/, ''); }
function titleOf(text, filename) {
  const match = text.match(/^title:\s*["']?(.*?)["']?\s*$/m);
  return match ? match[1] : filename.slice(11, -3).replace(/-/g, ' ');
}
function scoreBrief(sourceText, brief) {
  const haystack = sourceText.toLowerCase();
  const phrases = brief.topic.toLowerCase().split(/\s+(?:versus|vs\.?|and|for|using|before|without|the|a|an|to)\s+/).filter(phrase => phrase.length > 5);
  const words = brief.topic.toLowerCase().split(/\W+/).filter(word => word.length > 4);
  return phrases.filter(phrase => haystack.includes(phrase)).length * 5 + words.filter(word => haystack.includes(word)).length;
}
function chooseBrief(filename, source) {
  const sourceText = `${titleOf(source, filename)} ${bodyOf(source).slice(0, 5000)}`;
  const totalScore = brief => scoreBrief(filename, brief) * 4 + scoreBrief(sourceText, brief);
  return topicPlan.slice().sort((a, b) => totalScore(b) - totalScore(a))[0];
}
function parseTargets() {
  const targetIndex = process.argv.indexOf('--target');
  return targetIndex >= 0 ? [process.argv[targetIndex + 1]] : defaultTargets;
}

async function generateValidatedRewrite(brief, filename, comparisons) {
  let revision = null;
  let lastArticle = null;
  let lastErrors = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const article = await generateArticle(revision ? { ...brief, revision } : brief);
    const errors = validateArticle(article, comparisons);
    if (!errors.length) return article;
    lastArticle = article;
    lastErrors = errors;
    console.warn(`${filename} attempt ${attempt} rejected by ${errors.length} quality check(s)`);
    revision = {
      instruction: 'Revise the complete draft to correct every listed quality error. Preserve all valid evidence boundaries and return a complete replacement JSON article.',
      qualityErrors: errors,
      rejectedDraft: article
    };
  }
  const diagnosticsDir = path.join(root, '_drafts', 'rewrite-diagnostics');
  fs.mkdirSync(diagnosticsDir, { recursive: true });
  fs.writeFileSync(path.join(diagnosticsDir, `${filename}.json`), `${JSON.stringify({ filename, errors: lastErrors, rejectedDraft: lastArticle }, null, 2)}\n`, 'utf8');
  throw new Error(`${filename} failed quality checks after two OpenAI passes`);
}

(async () => {
  if (process.argv.includes('--show-topics')) {
    for (const filename of parseTargets()) {
      const source = fs.readFileSync(path.join(postsDir, filename), 'utf8');
      console.log(`${filename} -> ${chooseBrief(filename, source).topic}`);
    }
    return;
  }
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required; no fallback rewrite will be created');
  fs.mkdirSync(outputDir, { recursive: true });
  const acceptedRewrites = [];
  for (const [targetIndex, filename] of parseTargets().entries()) {
    if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(filename)) throw new Error(`Invalid target filename: ${filename}`);
    const sourcePath = path.join(postsDir, filename);
    if (!fs.existsSync(sourcePath)) throw new Error(`Target does not exist: ${filename}`);
    const source = fs.readFileSync(sourcePath, 'utf8');
    const brief = chooseBrief(filename, source);
    const archive = fs.readdirSync(postsDir).filter(name => name !== filename && name.endsWith('.md'))
      .map(name => ({ name, source: fs.readFileSync(path.join(postsDir, name), 'utf8') }));
    const relatedTitles = archive
      .filter(item => scoreBrief(`${item.name} ${titleOf(item.source, item.name)}`, brief) > 0)
      .map(item => titleOf(item.source, item.name)).slice(0, 20);
    const comparisons = archive.map(item => bodyOf(item.source));
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
          'Teach a useful decision process before presenting shopping options.',
          'Use a distinct reader problem, decision framework, examples, and practice plan; do not recreate the angles used by related archive pages.'
        ],
        relatedArchiveTitles: relatedTitles,
        distinctEditorialAngle: rewriteAngles[targetIndex % rewriteAngles.length]
      }
    };
    const article = await generateValidatedRewrite(articleBrief, filename, comparisons.concat(acceptedRewrites));
    acceptedRewrites.push(articleText(article));
    let rendered = renderArticle(article, date, slug, config.amazonTag, { prototype: false });
    rendered = rendered.replace('categories: deals\n', `categories: deals\nmigration_target: "_posts/${filename}"\noriginal_url_preserved: true\n`);
    fs.writeFileSync(path.join(outputDir, filename), rendered, 'utf8');
    console.log(`Drafted rewrite: ${filename}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
