'use strict';

const REQUIRED_DISCLOSURE = /commission|affiliate/i;
const GENERIC_PATTERNS = [
  /elevate your game/i,
  /without breaking the bank/i,
  /unbeatable value/i,
  /game.?changer/i
];

function words(value) {
  return String(value || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

function similarity(a, b) {
  const left = new Set(words(a));
  const right = new Set(words(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function articleText(article) {
  return [article.title, article.description, article.dek]
    .concat((article.sections || []).flatMap(section => [section.heading, section.body, section.recommendation]))
    .concat(article.takeaways || [])
    .concat((article.faq || []).flatMap(item => [item.question, item.answer]))
    .join('\n');
}

function validateArticle(article, comparisons = []) {
  const errors = [];
  const text = articleText(article);
  if (!['evergreen-guide', 'comparison', 'current-deals'].includes(article.articleType)) errors.push('invalid articleType');
  if (!article.title || article.title.length < 20 || article.title.length > 80) errors.push('title must be 20-80 characters');
  if (!article.description || article.description.length < 80 || article.description.length > 170) errors.push('description must be 80-170 characters');
  if (!Array.isArray(article.sections) || article.sections.length < 3) errors.push('at least three sections are required');
  if (!Array.isArray(article.sources) || article.sources.length < 2) errors.push('at least two sources are required');
  for (const source of article.sources || []) {
    try {
      const url = new URL(source.url);
      if (!['http:', 'https:'].includes(url.protocol)) errors.push(`unsupported source URL: ${source.url}`);
    } catch { errors.push(`invalid source URL: ${source.url}`); }
  }
  if (!REQUIRED_DISCLOSURE.test(article.affiliateDisclosure || '')) errors.push('affiliate disclosure must explain possible commission');
  for (const pattern of GENERIC_PATTERNS) if (pattern.test(text)) errors.push(`generic phrase rejected: ${pattern}`);
  if (/\$\d|\d+% off/i.test(text) && !(article.sources || []).some(source => /price|deal|promotion|discount/i.test(source.supports))) {
    errors.push('price or discount claim lacks an explicitly supporting source');
  }
  comparisons.forEach((comparison, index) => {
    const score = similarity(text, comparison);
    if (score >= 0.58) errors.push(`too similar to comparison ${index + 1} (${score.toFixed(2)})`);
  });
  return errors;
}

module.exports = { articleText, similarity, validateArticle };
