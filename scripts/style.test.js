'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('featured story keeps a dark background behind its light text', () => {
  const stylesheet = fs.readFileSync('assets/main.scss', 'utf8');
  assert.match(
    stylesheet,
    /\.featured-story\s*\{[^}]*color:\s*white;[^}]*background:\s*linear-gradient\(125deg,#101713 0%,#174d35 100%\)/s
  );

  const lightSurfaceRule = stylesheet.match(/([^{}]+)\{\s*background:\s*rgba\(255,253,248,\.94\);\s*\}/);
  assert.ok(lightSurfaceRule, 'expected shared light surface rule');
  assert.doesNotMatch(lightSurfaceRule[1], /\.featured-story/);
});
