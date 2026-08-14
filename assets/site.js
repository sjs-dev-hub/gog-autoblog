(() => {
  const searchInput = document.querySelector('[data-guide-search]');
  const results = document.querySelector('[data-search-results]');
  let indexPromise;

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function searchWords(value) {
    const ignored = new Set(['guild', 'golf', 'daily', 'deals', 'guide', 'the', 'and', 'for', 'with', 'how', 'choose']);
    const raw = String(value).toLowerCase().match(/[a-z0-9]+/g) || [];
    const useful = raw.filter(word => !ignored.has(word) && !/^\d+$/.test(word));
    return useful.length ? useful : raw;
  }

  function overlap(left, right) {
    const a = new Set(searchWords(left));
    const b = new Set(searchWords(right));
    if (!a.size || !b.size) return 0;
    let shared = 0;
    for (const word of a) if (b.has(word)) shared += 1;
    return shared / Math.min(a.size, b.size);
  }

  function resultBucket(guide, query) {
    const text = `${guide.title} ${guide.excerpt}`.toLowerCase();
    const topics = ['putting mirror', 'putting mat', 'putting alignment', 'putting pace', 'launch monitor', 'swing analyzer', 'tempo trainer', 'alignment sticks', 'golf balls', 'driver fitting', 'driver loft', 'draw bias', 'game improvement irons', 'wedge gaps'];
    return topics.find(topic => text.includes(topic)) || searchWords(query)[0] || 'general';
  }

  function rankGuides(guides, query, limit = 8) {
    const normalizedQuery = query.trim().toLowerCase();
    const queryWords = searchWords(normalizedQuery);
    const ranked = guides.map((guide, order) => {
      const title = guide.title.toLowerCase();
      const excerpt = guide.excerpt.toLowerCase();
      const allText = `${title} ${excerpt}`;
      if (!queryWords.every(word => allText.includes(word))) return null;
      let score = guide.editorial ? 100 : 0;
      if (title.includes(normalizedQuery)) score += 45;
      score += queryWords.filter(word => title.includes(word)).length * 14;
      score += queryWords.filter(word => excerpt.includes(word)).length * 4;
      return { guide, order, score, bucket: resultBucket(guide, normalizedQuery) };
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.order - b.order);

    const selected = [];
    const bucketCounts = new Map();
    for (const candidate of ranked) {
      if ((bucketCounts.get(candidate.bucket) || 0) >= 2) continue;
      if (selected.some(item => overlap(candidate.guide.title, item.guide.title) >= 0.72)) continue;
      selected.push(candidate);
      bucketCounts.set(candidate.bucket, (bucketCounts.get(candidate.bucket) || 0) + 1);
      if (selected.length === limit) break;
    }
    return selected.map(item => item.guide);
  }

  function displayTitle(title) {
    return title.replace(/^Guild of Golf\s*[—-]\s*Daily Deals\s*[—-]\s*\d{4}-\d{2}-\d{2}:?\s*/i, '') || title;
  }

  if (searchInput && results) {
    searchInput.addEventListener('input', async () => {
      const query = searchInput.value.trim().toLowerCase();
      if (query.length < 2) {
        results.hidden = true;
        results.innerHTML = '';
        return;
      }
      indexPromise ||= fetch('/search.json').then(response => {
        if (!response.ok) throw new Error('Search index unavailable');
        return response.json();
      });
      try {
        const guides = await indexPromise;
        const matches = rankGuides(guides, query);
        results.innerHTML = matches.length
          ? matches.map(guide => `<a href="${escapeHtml(guide.url)}"><small>${escapeHtml(guide.type)} · ${escapeHtml(guide.date)}</small><strong>${escapeHtml(displayTitle(guide.title))}</strong><span>${escapeHtml(guide.excerpt)}</span></a>`).join('')
          : '<p>No guides found. Try a gear type, problem, or practice goal.</p>';
        results.hidden = false;
      } catch {
        results.innerHTML = '<p>Search is temporarily unavailable. Browse the latest guides below.</p>';
        results.hidden = false;
      }
    });
    document.querySelectorAll('[data-search-suggestion]').forEach(button => {
      button.addEventListener('click', () => {
        searchInput.value = button.dataset.searchSuggestion;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.focus();
      });
    });
  }

  const article = document.querySelector('.post-content');
  const rail = document.querySelector('.article-rail');
  if (!article || !rail) return;

  article.querySelectorAll('p').forEach(paragraph => {
    const text = paragraph.textContent.trim();
    if (text === '**' || /^<\/(?:div|section)>$/.test(text) || /^Sample product types:/i.test(text)) paragraph.remove();
  });

  const headings = Array.from(article.querySelectorAll('h2'));
  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = `section-${index + 1}`;
  });
  if (headings.length > 1) {
    const navigation = document.createElement('nav');
    navigation.className = 'article-toc';
    navigation.setAttribute('aria-label', 'On this page');
    navigation.innerHTML = `<span>In this guide</span>${headings.slice(0, 7).map(heading => `<a href="#${heading.id}">${escapeHtml(heading.textContent)}</a>`).join('')}`;
    rail.appendChild(navigation);
  }

  if (!article.querySelector('.decision-card')) {
    article.classList.add('legacy-content');
    article.querySelectorAll('p').forEach(paragraph => {
      if (paragraph.firstElementChild?.tagName === 'STRONG' && paragraph.textContent.includes('—')) paragraph.classList.add('legacy-product-intro');
    });
  }
})();
