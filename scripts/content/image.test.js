'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('article image prompt requests natural editorial photography with safe mobile composition', () => {
  const source = fs.readFileSync('scripts/content/image.js', 'utf8');
  assert.match(source, /photorealistic editorial golf photograph/);
  assert.match(source, /authentic natural light/);
  assert.match(source, /crops safely to a wide desktop frame and a taller mobile frame/);
  assert.match(source, /generic, unbranded golf equipment and clothing/);
  assert.match(source, /No logos, brands, words, letters, numbers, arrows/);
  assert.match(source, /Avoid uncanny anatomy/);
  assert.doesNotMatch(source, /cream textured paper/);
});

test('article photography uses an editorial overlay caption and a taller mobile crop', () => {
  const stylesheet = fs.readFileSync('assets/main.scss', 'utf8');
  assert.match(stylesheet, /\.article-hero\s*\{[^}]*position:\s*relative;[^}]*background:\s*#172119;/s);
  assert.match(stylesheet, /\.article-hero figcaption\s*\{[^}]*position:\s*absolute;[^}]*background:\s*rgba\(16,23,19,\.78\);/s);
  assert.match(stylesheet, /@media \(max-width:\s*760px\)[\s\S]*?\.article-hero img\s*\{\s*aspect-ratio:\s*4\/3;\s*\}/);
});
