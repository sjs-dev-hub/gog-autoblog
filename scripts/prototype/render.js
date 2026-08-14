'use strict';

function escapeYaml(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function articleTopics(article, slug) {
  const haystack = `${slug} ${article.title} ${article.topic || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const taxonomy = [
    ['Putting', ['putt', 'putter', 'putting']],
    ['Driving', ['driver', 'driving', 'tee-shot', 'draw-bias', 'high-moi']],
    ['Wedges & Short Game', ['wedge', 'chipping', 'pitching', 'short-game']],
    ['Irons', ['iron', 'irons', 'hollow-body', 'players-distance']],
    ['Golf Balls', ['golf-ball', 'golf-balls', 'pro-v1', 'two-piece', 'three-piece']],
    ['Practice & Training', ['practice', 'trainer', 'training', 'alignment-stick', 'impact-bag', 'swing-analyzer', 'tempo']],
    ['Technology', ['launch-monitor', 'rangefinder', 'gps', 'sensor', 'technology', 'tech']],
    ['Bags & Accessories', ['golf-bag', 'stand-bag', 'cart-bag', 'glove', 'towel', 'accessory']]
  ];
  const topics = taxonomy.filter(([, terms]) => terms.some(term => haystack.includes(term))).map(([name]) => name);
  return topics.length ? topics : ['General Gear'];
}

function renderArticle(article, date, slug, amazonTag, options = { prototype: true }) {
  const verdict = article.verdict || {
    bottomLine: article.dek,
    bestFor: article.audience,
    skipIf: 'Readers who have not yet identified the decision or practice problem they need to solve.'
  };
  const visualBrief = article.visualBrief || {
    alt: 'Editorial golf equipment buying-guide illustration.',
    caption: 'Use the decision criteria in this guide before comparing products.'
  };
  const shoppingOptions = article.shoppingOptions || [{ label: 'Compare relevant options', query: article.title, why: 'Use the criteria above to compare the options currently available.' }];
  const practicePlan = article.practicePlan;
  const lines = [
    '---',
    'layout: post',
    `title: "${escapeYaml(article.title)}"`,
    `description: "${escapeYaml(article.description)}"`,
    `date: ${date} 07:00:00 +0000`,
    'categories: deals',
    `topics: [${articleTopics(article, slug).map(topic => `"${escapeYaml(topic)}"`).join(', ')}]`,
    `article_type: ${article.articleType}`,
    `hero_alt: "${escapeYaml(visualBrief.alt)}"`,
    `hero_caption: "${escapeYaml(visualBrief.caption)}"`,
    `visual_prompt: "${escapeYaml(article.visualBrief?.concept || '')}"`,
    '---', '',
    '<div class="article-audience" markdown="1">', '',
    `**Built for:** ${article.audience}`, '',
    '</div>', '',
    article.dek, '',
    '<section class="decision-card" aria-label="Quick verdict" markdown="1">', '',
    '## The quick verdict', '',
    verdict.bottomLine, '',
    '<div class="decision-grid" markdown="1">', '',
    '<div class="decision-item">', `<strong>Best for</strong>`, `<span>${verdict.bestFor}</span>`, '</div>',
    '<div class="decision-item">', `<strong>Skip it if</strong>`, `<span>${verdict.skipIf}</span>`, '</div>', '',
    '</div>', '',
    '</section>', ''
  ];
  if (options.prototype !== false) {
    lines.splice(7, 0, 'prototype: true', `permalink: /prototype/${slug}/`);
  }
  if (options.heroImage) {
    const closingFrontMatter = lines.indexOf('---', 1);
    lines.splice(closingFrontMatter, 0, `hero_image: "${escapeYaml(options.heroImage)}"`);
  }
  for (const section of article.sections) {
    lines.push(`## ${section.heading}`, '', section.body, '', `**Guild recommendation:** ${section.recommendation}`, '');
  }
  if (practicePlan) {
    lines.push('<section class="practice-plan" aria-label="Practice plan" markdown="1">', '', `<p class="practice-time">Try this · ${practicePlan.time}</p>`, '', `## ${practicePlan.title}`, '', practicePlan.setup, '', '<ol>', '');
    practicePlan.steps.forEach(step => lines.push(`<li>${step}</li>`));
    lines.push('', '</ol>', '', `<p class="success-signal"><strong>What progress looks like:</strong> ${practicePlan.successSignal}</p>`, '', '</section>', '');
  }
  lines.push('<section class="shopping-guide" aria-label="Shopping options" markdown="1">', '', '## Put the guide to work', '', '<p class="shopping-intro">These searches are a starting point—not a substitute for the fit and comparison criteria above.</p>', '', '<div class="shopping-grid" markdown="1">', '');
  shoppingOptions.forEach(option => {
    const optionLink = `https://www.amazon.com/s?k=${encodeURIComponent(option.query)}&tag=${encodeURIComponent(amazonTag)}`;
    lines.push('<div class="shopping-option">', '', `### ${option.label}`, '', option.why, '', `<a href="${optionLink}" class="gg-cta" target="_blank" rel="sponsored noopener">See current options <span aria-hidden="true">↗</span></a>`, '', '</div>', '');
  });
  lines.push('</div>', '', '<p class="shopping-disclosure">If you buy through these links, Guild of Golf may earn a commission at no extra cost to you.</p>', '', '</section>', '', '## The practical takeaway', '');
  article.takeaways.forEach(item => lines.push(`- ${item}`));
  lines.push('', '## Frequently asked questions', '');
  article.faq.forEach(item => lines.push(`### ${item.question}`, '', item.answer, ''));
  lines.push('## Sources used for this draft', '');
  article.sources.forEach(source => lines.push(`- [${source.title}](${source.url}) — ${source.supports}`));
  lines.push('', `*${article.affiliateDisclosure}*`, '');
  return lines.join('\n');
}

module.exports = { renderArticle };
