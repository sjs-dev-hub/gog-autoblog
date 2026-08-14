'use strict';

const { articleSchema } = require('../prototype/article-schema');

function extractOutputText(payload) {
  return payload.output_text || (payload.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text')
    .map(item => item.text)
    .join('');
}

async function generateArticle(brief, model = process.env.OPENAI_MODEL || 'gpt-5.6-terra') {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required; refusing to publish fallback copy');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      reasoning: { effort: 'medium' },
      input: [
        {
          role: 'system',
          content: 'You are the Guild of Golf editor. Write evidence-bound, useful golf buying guidance. Use only the supplied evidence for factual claims and cite only supplied source URLs. Explain tradeoffs and who should not buy an item. Never invent personal testing, prices, discounts, inventory, specifications, reviews, or urgency. Avoid generic marketing phrases. Return the requested JSON only.'
        },
        { role: 'user', content: JSON.stringify(brief) }
      ],
      text: { format: { type: 'json_schema', name: 'golf_article', strict: true, schema: articleSchema } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI request failed (${response.status}): ${await response.text()}`);
  const outputText = extractOutputText(await response.json());
  if (!outputText) throw new Error('OpenAI response did not contain structured output text');
  return JSON.parse(outputText);
}

module.exports = { extractOutputText, generateArticle };
