'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { isLegacyPost, nextLegacyPost, preserveOriginalRouting } = require('./queue');

test('archive queue selects the newest eligible legacy post', () => {
  const entries = [
    { filename: '2026-08-06-old.md', source: '---\ntitle: Old\n---\nLegacy' },
    { filename: '2026-08-07-newest.md', source: '---\ntitle: Newest\n---\nLegacy' },
    { filename: '2026-08-08-editorial.md', source: '---\narticle_type: evergreen\n---\nEdited' },
    { filename: '2026-08-09-excluded.md', source: '---\nlibrary_exclude: true\n---\nDuplicate' }
  ];
  assert.equal(nextLegacyPost(entries), '2026-08-07-newest.md');
  assert.equal(isLegacyPost(entries[2].filename, entries[2].source), false);
  assert.equal(isLegacyPost(entries[3].filename, entries[3].source), false);
});

test('in-place rewrites preserve explicit dates and permalinks', () => {
  const source = '---\ndate: 2026-08-07 12:34:00 -0500\npermalink: /kept-url/\n---\nOld';
  const rendered = '---\ndate: 2026-08-07 07:00:00 +0000\ncategories: deals\n---\nNew';
  const result = preserveOriginalRouting(rendered, source);
  assert.match(result, /date: 2026-08-07 12:34:00 -0500/);
  assert.match(result, /permalink: \/kept-url\//);
});
