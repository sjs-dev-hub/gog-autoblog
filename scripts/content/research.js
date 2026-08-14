'use strict';

const trendSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['topic', 'audience', 'articleType', 'whyNow', 'evidence'],
  properties: {
    topic: { type: 'string', minLength: 20, maxLength: 140 },
    audience: { type: 'string', minLength: 20, maxLength: 220 },
    articleType: { type: 'string', enum: ['comparison', 'current-deals'] },
    whyNow: { type: 'string', minLength: 30, maxLength: 400 },
    evidence: {
      type: 'array', minItems: 2, maxItems: 6,
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'url', 'publishedAt', 'facts'],
        properties: {
          title: { type: 'string', minLength: 4, maxLength: 180 },
          url: { type: 'string', minLength: 12, maxLength: 500 },
          publishedAt: { type: 'string', minLength: 10, maxLength: 10 },
          facts: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string', minLength: 15, maxLength: 300 } }
        }
      }
    }
  }
};

function extractOutputText(payload) {
  return payload.output_text || (payload.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text)
    .join('');
}

function extractCitationUrls(payload) {
  return new Set((payload.output || []).flatMap(item => item.content || [])
    .flatMap(content => content.annotations || [])
    .map(annotation => annotation.url || annotation.url_citation?.url)
    .filter(Boolean)
    .map(normalizeUrl));
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch { return ''; }
}

function validateTrend(trend, citedUrls, date, recentText = '') {
  const errors = [];
  const evidence = trend?.evidence || [];
  if (!trend?.topic || !trend?.audience) errors.push('research did not return a usable topic and audience');
  if (!['comparison', 'current-deals'].includes(trend?.articleType)) errors.push('research returned an invalid article type');
  if (evidence.length < 2) errors.push('current topic requires at least two sources');
  const domains = new Set();
  let recentSources = 0;
  const publicationDate = new Date(`${date}T23:59:59Z`);
  for (const source of evidence) {
    const normalized = normalizeUrl(source.url);
    if (!normalized || !citedUrls.has(normalized)) errors.push(`source was not returned as a web-search citation: ${source.url}`);
    try { domains.add(new URL(source.url).hostname.replace(/^www\./, '')); } catch { errors.push(`invalid research URL: ${source.url}`); }
    const published = new Date(`${source.publishedAt}T00:00:00Z`);
    const ageDays = (publicationDate - published) / 86400000;
    if (!Number.isFinite(ageDays) || ageDays < -2) errors.push(`invalid or future source date: ${source.publishedAt}`);
    if (ageDays >= 0 && ageDays <= 120) recentSources += 1;
  }
  if (domains.size < 2) errors.push('current topic requires sources from at least two domains');
  if (recentSources < 1) errors.push('current topic requires a source published within 120 days');
  const topicWords = String(trend?.topic || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  const overlap = topicWords.filter(word => word.length > 4 && recentText.toLowerCase().includes(word));
  if (topicWords.length && overlap.length / topicWords.length > 0.7) errors.push('current topic substantially overlaps recent coverage');
  return errors;
}

async function discoverCurrentTrend({ date, recentTitles }, model = process.env.OPENAI_MODEL || 'gpt-5.6-terra') {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for current-topic research');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'medium' },
      tools: [{ type: 'web_search' }],
      input: [
        { role: 'system', content: 'You are the research desk for an independent golf-equipment publication. Search the live web before answering. Find one genuinely useful current equipment story: a new product launch, meaningful equipment update, or independently reviewed product category. Prefer primary manufacturer specifications plus credible independent editorial testing or reporting. Avoid rumors, thin rewrites, retailer listicles, coupon pages, unverifiable social posts, and price or availability claims without direct support. Distinguish announcements from products actually available. Every evidence URL must be a source returned by your web search. Use exact publication dates. Return JSON only.' },
        { role: 'user', content: JSON.stringify({ publicationDate: date, avoidRecentCoverage: recentTitles.slice(-60), task: 'Find a current golf-equipment topic from roughly the last 120 days that helps a golfer make a better playing, fitting, practice, or buying decision.' }) }
      ],
      text: { format: { type: 'json_schema', name: 'golf_trend_research', strict: true, schema: trendSchema } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI research request failed (${response.status}): ${await response.text()}`);
  const payload = await response.json();
  const outputText = extractOutputText(payload);
  if (!outputText) throw new Error('OpenAI research response did not contain structured output text');
  const trend = JSON.parse(outputText);
  const errors = validateTrend(trend, extractCitationUrls(payload), date, recentTitles.join('\n'));
  if (errors.length) throw new Error(`Current-topic research failed validation:\n- ${errors.join('\n- ')}`);
  return trend;
}

module.exports = { discoverCurrentTrend, extractCitationUrls, normalizeUrl, trendSchema, validateTrend };
