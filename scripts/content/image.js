'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

async function generateArticleImage(article, date, slug) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for article image generation');
  const prompt = [
    'Create an original, photorealistic editorial golf photograph for a Guild of Golf field guide.',
    `Editorial concept: ${article.visualBrief.concept}`,
    'Use authentic natural light, realistic skin, fabric, turf, weather, and equipment materials, with the restrained polish of a premium golf magazine photo essay.',
    'Show a believable adult golfer when the concept benefits from a person; use an ordinary, attainable practice or course setting rather than a glossy advertisement.',
    'Compose one clear teaching moment with the primary subject near the center so the same photograph crops safely to a wide desktop frame and a taller mobile frame.',
    'Leave calm negative space where a future HTML caption or annotation could sit, but do not render the annotation into the photograph.',
    'Use generic, unbranded golf equipment and clothing only. No recognizable commercial product designs.',
    'No logos, brands, words, letters, numbers, arrows, prices, user interface, border, collage, illustration, or watermark.',
    'Avoid uncanny anatomy, extra fingers or limbs, malformed clubs, impossible grip positions, and physically implausible ball placement.',
    'Do not imply hands-on testing or a product endorsement.'
  ].join(' ');
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
      prompt,
      size: '1536x1024',
      quality: 'medium',
      output_format: 'webp'
    })
  });
  if (!response.ok) throw new Error(`OpenAI image request failed (${response.status}): ${await response.text()}`);
  const payload = await response.json();
  if (payload.usage) console.log(`OpenAI image usage: ${JSON.stringify(payload.usage)}`);
  const base64 = payload.data?.[0]?.b64_json;
  if (!base64) throw new Error('OpenAI image response did not contain image data');
  const relativePath = path.posix.join('/assets/generated/articles', `${date}-${slug}.webp`);
  const outputPath = path.join(root, relativePath.slice(1));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'));
  return relativePath;
}

module.exports = { generateArticleImage };
