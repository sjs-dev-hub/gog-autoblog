'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { similarity, validateArticle } = require('./quality');
const { renderArticle } = require('./render');
const { normalizeUrl, validateTrend } = require('../content/research');
const { extractOutputText } = require('../content/openai');

test('similarity recognizes identical and unrelated copy', () => {
  assert.equal(similarity('forgiving driver for slower swings', 'forgiving driver for slower swings'), 1);
  assert.ok(similarity('driver launch and spin', 'putting alignment mirror') < 0.2);
});

test('validator rejects unsupported price claims and generic filler', () => {
  const article = {
    articleType: 'comparison', title: 'A sufficiently descriptive golf comparison title',
    description: 'A sufficiently detailed description that explains the practical purpose of this comparison for golfers.',
    sections: [{ heading: 'Decision', body: 'This option is a game-changer at $299.', recommendation: 'Choose according to fit.' }],
    sources: [{ title: 'Rules', url: 'https://example.com/rules', supports: 'Equipment rules only' }],
    affiliateDisclosure: 'We may earn an affiliate commission from qualifying purchases.'
  };
  const errors = validateArticle(article);
  assert.ok(errors.some(error => error.includes('generic phrase')));
  assert.ok(errors.some(error => error.includes('price or discount')));
});

test('production renderer uses the supplied associate tag and omits prototype metadata', () => {
  const article = {
    articleType: 'evergreen-guide', title: 'A useful driver fitting guide for ordinary golfers',
    description: 'A detailed description long enough for the renderer test and for a useful search result description.',
    audience: 'Golfers', dek: 'A sufficiently useful introduction for a rendering test.',
    sections: [], takeaways: [], faq: [], sources: [],
    affiliateDisclosure: 'We may earn an affiliate commission from qualifying purchases.'
  };
  const markdown = renderArticle(article, '2026-08-13', 'driver-guide', 'guildofgolf02-20', { prototype: false });
  assert.match(markdown, /tag=guildofgolf02-20/);
  assert.doesNotMatch(markdown, /prototype: true|permalink: \/prototype\//);
});

test('Responses payload text can be extracted from raw output items', () => {
  const payload = { output: [{ content: [{ type: 'output_text', text: '{"ok":true}' }] }] };
  assert.equal(extractOutputText(payload), '{"ok":true}');
});

test('current-topic research requires cited, recent, multi-domain evidence', () => {
  const trend = {
    articleType: 'comparison',
    topic: 'What a newly released adjustable driver changes for fitting decisions',
    audience: 'Golfers comparing a newly released driver with their current fitted club.',
    evidence: [
      { title: 'Launch', url: 'https://maker.example/new-driver', publishedAt: '2026-08-01', facts: ['The manufacturer announced the fitting options.'] },
      { title: 'Review', url: 'https://review.example/driver-test', publishedAt: '2026-08-05', facts: ['Independent testing discusses the relevant tradeoffs.'] }
    ]
  };
  const citations = new Set(trend.evidence.map(source => normalizeUrl(source.url)));
  assert.deepEqual(validateTrend(trend, citations, '2026-08-14'), []);
  assert.match(validateTrend(trend, new Set(), '2026-08-14').join('\n'), /not returned as a web-search citation/);
});
