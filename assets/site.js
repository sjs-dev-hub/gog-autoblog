(() => {
  const searchInput = document.querySelector('[data-guide-search]');
  const results = document.querySelector('[data-search-results]');
  let indexPromise;

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
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
        const matches = guides.filter(guide => `${guide.title} ${guide.excerpt}`.toLowerCase().includes(query)).slice(0, 8);
        results.innerHTML = matches.length
          ? matches.map(guide => `<a href="${escapeHtml(guide.url)}"><small>${escapeHtml(guide.type)} · ${escapeHtml(guide.date)}</small><strong>${escapeHtml(guide.title)}</strong><span>${escapeHtml(guide.excerpt)}</span></a>`).join('')
          : '<p>No guides found. Try a gear type, problem, or practice goal.</p>';
        results.hidden = false;
      } catch {
        results.innerHTML = '<p>Search is temporarily unavailable. Browse the latest guides below.</p>';
        results.hidden = false;
      }
    });
  }

  const article = document.querySelector('.post-content');
  const rail = document.querySelector('.article-rail');
  if (!article || !rail) return;

  article.querySelectorAll('p').forEach(paragraph => {
    if (paragraph.textContent.trim() === '**') paragraph.remove();
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
