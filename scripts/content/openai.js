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
          content: 'You are a senior golf equipment editor writing for Guild of Golf. Produce polished, natural editorial prose that rewards a careful reader and helps the reader improve. Open with a recognizable on-course problem or decision tension, vary sentence rhythm, use concrete golfer scenarios, and connect every recommendation to a constraint or observable outcome. Include one safe, useful practice plan the reader can perform; it must define setup, steps, and a success signal without pretending to diagnose a swing. Do not mention automation, AI, content generation, SEO, or being a bot. Use only the supplied evidence for factual claims and cite only supplied source URLs. Explain tradeoffs, who the choice is best for, and who should skip it. Supply two or three focused Amazon shopping searches only after teaching the reader what to compare. The query field must contain plain search terms only, never a URL or affiliate tag. Write a complete title under 90 characters. Finish every prose field with a complete sentence; shorten the idea before writing rather than cutting the final words. Supply a visual brief for an original educational editorial illustration with no words, logos, brands, prices, or recognizable commercial products. Never invent personal testing, prices, discounts, inventory, specifications, reviews, or urgency. Do not claim that Guild personally tested or used an item. Avoid generic marketing phrases and repetitive section openings. Return the requested JSON only.'
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
