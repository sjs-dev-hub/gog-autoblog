'use strict';

function isLegacyPost(filename, source) {
  return /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(filename)
    && !/^article_type:\s*\S+/m.test(source)
    && !/^library_exclude:\s*true\s*$/mi.test(source);
}

function nextLegacyPost(entries) {
  return entries
    .filter(entry => isLegacyPost(entry.filename, entry.source))
    .sort((a, b) => b.filename.localeCompare(a.filename))[0]?.filename || null;
}

function preserveOriginalRouting(rendered, source) {
  const originalDate = source.match(/^date:\s*.+$/m)?.[0];
  const originalPermalink = source.match(/^permalink:\s*.+$/m)?.[0];
  let result = originalDate ? rendered.replace(/^date:\s*.+$/m, originalDate) : rendered;
  if (originalPermalink && !/^permalink:\s*.+$/m.test(result)) {
    result = result.replace(/^categories:\s*.+$/m, match => `${match}\n${originalPermalink}`);
  }
  return result;
}

module.exports = { isLegacyPost, nextLegacyPost, preserveOriginalRouting };
