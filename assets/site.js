(() => {
  const searchInput = document.querySelector('[data-guide-search]');
  const results = document.querySelector('[data-search-results]');
  let indexPromise;

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function normalizeWord(word) {
    if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
    if (word.length > 4 && word.endsWith('es') && /(sses|shes|ches|xes|zes)$/.test(word)) return word.slice(0, -2);
    if (word.length > 4 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
  }

  function searchWords(value) {
    const ignored = new Set(['guild', 'golf', 'daily', 'deals', 'guide', 'the', 'and', 'for', 'with', 'how', 'choose']);
    const raw = String(value).toLowerCase().match(/[a-z0-9]+/g) || [];
    const useful = raw.filter(word => !ignored.has(word) && !/^\d+$/.test(word)).map(normalizeWord);
    return useful.length ? useful : raw;
  }

  function rankGuides(guides, query) {
    const normalizedQuery = query.trim().toLowerCase();
    const queryWords = searchWords(normalizedQuery);
    return guides.map((guide, order) => {
      const title = guide.title.toLowerCase();
      const excerpt = guide.excerpt.toLowerCase();
      const searchable = new Set(searchWords(`${title} ${excerpt} ${guide.searchText || ''}`));
      if (!queryWords.every(word => searchable.has(word))) return null;
      let score = guide.editorial ? 100 : 0;
      if (title.includes(normalizedQuery)) score += 45;
      const titleWords = searchWords(title);
      const excerptWords = searchWords(excerpt);
      score += queryWords.filter(word => titleWords.includes(word)).length * 14;
      score += queryWords.filter(word => excerptWords.includes(word)).length * 4;
      return { guide, order, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.order - b.order).map(item => item.guide);
  }

  function displayTitle(title) {
    return title.replace(/^Guild of Golf\s*[—-]\s*Daily Deals\s*[—-]\s*\d{4}-\d{2}-\d{2}:?\s*/i, '') || title;
  }

  function resultMarkup(guide) {
    const topics = (guide.topics || []).slice(0, 2).map(topic => `<em>${escapeHtml(topic)}</em>`).join('');
    return `<a href="${escapeHtml(guide.url)}"><small>${escapeHtml(guide.type)} · ${escapeHtml(guide.date)}</small><strong>${escapeHtml(displayTitle(guide.title))}</strong><span>${escapeHtml(guide.excerpt)}</span>${topics ? `<span class="result-topics">${topics}</span>` : ''}</a>`;
  }

  if (searchInput && results) {
    const library = document.querySelector('[data-guide-library]');
    const count = document.querySelector('[data-library-count]');
    const more = document.querySelector('[data-library-more]');
    const topicFilters = document.querySelector('[data-topic-filters]');
    let currentMatches = [];
    let visible = 18;
    let selectedTopic = new URLSearchParams(window.location.search).get('topic') || '';

    function renderTopicFilters(guides) {
      if (!topicFilters) return;
      const counts = new Map();
      guides.forEach(guide => (guide.topics || []).forEach(topic => counts.set(topic, (counts.get(topic) || 0) + 1)));
      const topics = [...counts.entries()].filter(([, total]) => total >= 5).sort((a, b) => b[1] - a[1]);
      topicFilters.innerHTML = `<button type="button" data-topic="" class="${selectedTopic ? '' : 'active'}">All guides <span>${guides.length}</span></button>${topics.map(([topic, total]) => `<button type="button" data-topic="${escapeHtml(topic)}" class="${selectedTopic === topic ? 'active' : ''}">${escapeHtml(topic)} <span>${total}</span></button>`).join('')}`;
      topicFilters.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => {
        selectedTopic = button.dataset.topic;
        runSearch();
      }));
    }

    function renderLibrary() {
      const shown = currentMatches.slice(0, visible);
      const remaining = Math.max(0, currentMatches.length - shown.length);
      results.innerHTML = shown.length ? shown.map(resultMarkup).join('') : '<p>No guides found. Try a broader gear type, problem, or practice goal.</p>';
      if (count) count.textContent = searchInput.value.trim() ? `${currentMatches.length} matching guides` : `${currentMatches.length} published guides`;
      if (more) {
        more.hidden = remaining === 0;
        more.textContent = remaining ? `Show more (${remaining} remaining)` : 'All guides shown';
      }
    }

    async function runSearch() {
      const query = searchInput.value.trim().toLowerCase();
      if (!library && query.length < 2) {
        results.hidden = true;
        results.innerHTML = '';
        return;
      }
      indexPromise ||= fetch('/search.json', { cache: 'no-store' }).then(response => {
        if (!response.ok) throw new Error('Search index unavailable');
        return response.json();
      });
      try {
        const guides = (await indexPromise).filter(guide => !guide.libraryExclude);
        if (library) renderTopicFilters(guides);
        const searched = query.length >= 2 ? rankGuides(guides, query) : guides;
        const matches = selectedTopic ? searched.filter(guide => (guide.topics || []).includes(selectedTopic)) : searched;
        if (library) {
          currentMatches = matches;
          visible = 18;
          renderLibrary();
          const url = new URL(window.location.href);
          query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
          selectedTopic ? url.searchParams.set('topic', selectedTopic) : url.searchParams.delete('topic');
          history.replaceState(null, '', url);
        } else {
          const preview = matches.slice(0, 8);
          results.innerHTML = preview.length
            ? `${preview.map(resultMarkup).join('')}<a class="search-all" href="/guides/?q=${encodeURIComponent(query)}"><strong>View all ${matches.length} matching guides →</strong></a>`
            : '<p>No guides found. Try a broader gear type, problem, or practice goal.</p>';
        }
        results.hidden = false;
      } catch {
        results.innerHTML = '<p>Search is temporarily unavailable. Browse the latest guides below.</p>';
        results.hidden = false;
      }
    }

    searchInput.addEventListener('input', runSearch);
    if (more) more.addEventListener('click', () => {
      visible = Math.min(visible + 18, currentMatches.length);
      renderLibrary();
    });
    document.querySelectorAll('[data-search-suggestion]').forEach(button => {
      button.addEventListener('click', () => {
        searchInput.value = button.dataset.searchSuggestion;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.focus();
      });
    });
    if (library) {
      searchInput.value = new URLSearchParams(window.location.search).get('q') || '';
      runSearch();
    }
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
