'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

async function generateArticleImage(article, date, slug) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for article image generation');
  const prompt = [
    'Create an original premium editorial illustration for a Guild of Golf buying guide.',
    `Editorial concept: ${article.visualBrief.concept}`,
    'Use a refined golf-magazine style with cream textured paper, deep forest green, muted gold, and restrained slate-blue accents.',
    'Make the image educational and visually legible at both desktop and mobile sizes.',
    'Use generic golf equipment only. No recognizable commercial product designs.',
    'No people, logos, brands, words, letters, numbers, prices, user interface, or watermark.',
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
