'use strict';

function escapeYaml(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderArticle(article, date, slug, amazonTag, options = { prototype: true }) {
  const searchLink = `https://www.amazon.com/s?k=${encodeURIComponent(article.title)}&tag=${encodeURIComponent(amazonTag)}`;
  const verdict = article.verdict || {
    bottomLine: article.dek,
    bestFor: article.audience,
    skipIf: 'Readers who have not yet identified the decision or practice problem they need to solve.'
  };
  const visualBrief = article.visualBrief || {
    alt: 'Editorial golf equipment buying-guide illustration.',
    caption: 'Use the decision criteria in this guide before comparing products.'
  };
  const lines = [
    '---',
    'layout: post',
    `title: "${escapeYaml(article.title)}"`,
    `description: "${escapeYaml(article.description)}"`,
    `date: ${date} 07:00:00 +0000`,
    'categories: deals',
    `article_type: ${article.articleType}`,
    `hero_alt: "${escapeYaml(visualBrief.alt)}"`,
    `hero_caption: "${escapeYaml(visualBrief.caption)}"`,
    `visual_prompt: "${escapeYaml(article.visualBrief?.concept || '')}"`,
    '---', '',
    '<div class="article-audience">', '',
    `**Built for:** ${article.audience}`, '',
    '</div>', '',
    article.dek, '',
    '<section class="decision-card" aria-label="Quick verdict">', '',
    '## The quick verdict', '',
    verdict.bottomLine, '',
    '<div class="decision-grid">', '',
    `<div><strong>Best for</strong><span>${verdict.bestFor}</span></div>`,
    `<div><strong>Skip it if</strong><span>${verdict.skipIf}</span></div>`, '',
    '</div>', '',
    '</section>', ''
  ];
  if (options.prototype !== false) {
    lines.splice(7, 0, 'prototype: true', `permalink: /prototype/${slug}/`);
  }
  for (const section of article.sections) {
    lines.push(`## ${section.heading}`, '', section.body, '', `**Guild recommendation:** ${section.recommendation}`, '');
  }
  lines.push('## The practical takeaway', '');
  article.takeaways.forEach(item => lines.push(`- ${item}`));
  lines.push('', ` [Compare relevant options on Amazon](${searchLink}){: .gg-cta }`, '', '## Frequently asked questions', '');
  article.faq.forEach(item => lines.push(`### ${item.question}`, '', item.answer, ''));
  lines.push('## Sources used for this draft', '');
  article.sources.forEach(source => lines.push(`- [${source.title}](${source.url}) — ${source.supports}`));
  lines.push('', `*${article.affiliateDisclosure}*`, '');
  return lines.join('\n');
}

module.exports = { renderArticle };
