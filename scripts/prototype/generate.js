'use strict';

const fs = require('fs');
const path = require('path');
const { articleSchema } = require('./article-schema');
const { articleText, validateArticle } = require('./quality');
const { renderArticle } = require('./render');

const root = path.resolve(__dirname, '..', '..');
const fixturesPath = path.join(root, '_prototype', 'fixtures.json');
const outputDir = path.join(root, '_drafts', 'prototypes');
const useFixtures = process.argv.includes('--fixtures');
const model = process.env.OPENAI_MODEL || 'gpt-5.6-terra';

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}

async function requestArticle(brief) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required unless --fixtures is used');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'medium' },
      input: [
        { role: 'system', content: 'You are a senior Guild of Golf equipment editor. Write polished, natural, specific golf buying guidance using only the evidence supplied. Teach the decision before presenting two or three focused shopping searches. State uncertainty. Never mention AI or automation and never invent prices, testing, discounts, specifications, reviews, or personal experience. Avoid generic marketing language.' },
        { role: 'user', content: JSON.stringify(brief) }
      ],
      text: { format: { type: 'json_schema', name: 'golf_article', strict: true, schema: articleSchema } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI request failed (${response.status}): ${await response.text()}`);
  const payload = await response.json();
  const outputText = payload.output_text || (payload.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text)
    .join('');
  if (!outputText) throw new Error('OpenAI response did not contain structured output text');
  return JSON.parse(outputText);
}

(async () => {
  const fixture = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
  const briefs = fixture.briefs;
  const articles = useFixtures ? fixture.samples : [];
  if (!useFixtures) for (const brief of briefs) articles.push(await requestArticle(brief));
  if (articles.length !== 3) throw new Error(`Expected three prototypes, received ${articles.length}`);

  const accepted = [];
  for (const article of articles) {
    const errors = validateArticle(article, accepted.map(articleText));
    if (errors.length) throw new Error(`${article.title || 'Untitled draft'} failed quality checks:\n- ${errors.join('\n- ')}`);
    accepted.push(article);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const date = '2026-08-13';
  for (const article of accepted) {
    const slug = slugify(article.title);
    const heroImages = {
      'how-to-choose-a-forgiving-driver-without-guessing': '/assets/generated/driver-fitting-field-guide.png',
      'putting-mirror-vs-putting-mat-which-feedback-do-you-need': '/assets/generated/putting-feedback-field-guide.png'
    };
    fs.writeFileSync(path.join(outputDir, `${date}-${slug}.md`), renderArticle(article, date, slug, fixture.amazonTag, { prototype: true, heroImage: heroImages[slug] }), 'utf8');
  }
  console.log(`Wrote ${accepted.length} validated, non-publishing drafts to ${path.relative(root, outputDir)}`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
