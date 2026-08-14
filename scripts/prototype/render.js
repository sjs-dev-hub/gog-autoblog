'use strict';

function escapeYaml(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderArticle(article, date, slug, amazonTag, options = { prototype: true }) {
  const searchLink = `https://www.amazon.com/s?k=${encodeURIComponent(article.title)}&tag=${encodeURIComponent(amazonTag)}`;
  const lines = [
    '---',
    'layout: post',
    `title: "${escapeYaml(article.title)}"`,
    `description: "${escapeYaml(article.description)}"`,
    `date: ${date} 07:00:00 +0000`,
    'categories: deals',
    `article_type: ${article.articleType}`,
    '---', '',
    `> **For:** ${article.audience}`, '',
    article.dek, ''
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
