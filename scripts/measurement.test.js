const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('crawler discovery files are configured', () => {
  const config = fs.readFileSync('_config.yml', 'utf8');
  const robots = fs.readFileSync('robots.txt', 'utf8');
  assert.match(config, /- jekyll-sitemap/);
  assert.match(robots, /Sitemap: \{\{ '\/sitemap\.xml' \| absolute_url \}\}/);
});

test('measurement identifiers are optional and contain no credentials', () => {
  const config = fs.readFileSync('_config.yml', 'utf8');
  const head = fs.readFileSync('_includes/head.html', 'utf8');
  assert.match(config, /google_analytics:\s*\n/);
  assert.match(config, /google_site_verification:\s*\n/);
  assert.match(head, /site\.google_analytics/);
  assert.doesNotMatch(config, /OPENAI_API_KEY|sk-[A-Za-z0-9_-]+/);
});

test('Amazon clicks emit a first-party analytics event without query data', () => {
  const script = fs.readFileSync('assets/site.js', 'utf8');
  assert.match(script, /event: 'affiliate_click'/);
  assert.match(script, /affiliate_network: 'amazon'/);
  assert.match(script, /window\.gtag\('event', eventName, parameters\)/);
  assert.match(script, /destination_path: destination\.pathname/);
  assert.doesNotMatch(script, /destination\.search/);
});
