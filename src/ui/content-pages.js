export function renderTracksPage({ tracks, completed, findLesson }) {
  return `
    <div class="lesson-header">
      <div class="eyebrow">Choose a route, not a lock</div>
      <h1>Learning tracks</h1>
      <p class="hero-copy">The full curriculum stays open. These tracks are curated sequences for learners who want a smaller, goal-oriented path through the same interactive labs.</p>
    </div>
    <div class="track-grid">
      ${tracks.map(track => {
        const lessons = track.lessons.map(id => findLesson(id)).filter(Boolean);
        const done = lessons.filter(lesson => completed.has(lesson.id)).length;
        const percent = lessons.length ? Math.round(done / lessons.length * 100) : 0;
        const next = lessons.find(lesson => !completed.has(lesson.id));
        return `<article class="track-card">
          <div class="track-icon">${track.icon}</div>
          <div class="eyebrow">${track.audience}</div><h2>${track.title}</h2><p style="color:var(--muted)">${track.description}</p>
          <div class="track-progress"><div class="node-row"><span>${done}/${lessons.length} complete</span><span>${percent}%</span></div><div class="bar req"><i style="width:${percent}%"></i></div></div>
          ${next ? `<button class="primary-btn" data-lesson="${next.id}" style="margin-top:14px">${done ? 'Continue' : 'Start'} → ${next.title}</button>` : '<div class="callout success"><strong>Track complete ✓</strong></div>'}
          <ol>${lessons.map(lesson => `<li>${completed.has(lesson.id) ? '✓ ' : ''}<button class="link-button" data-lesson="${lesson.id}">${lesson.title}</button></li>`).join('')}</ol>
        </article>`;
      }).join('')}
    </div>`;
}

export function renderGlossaryPage(items) {
  const sorted = [...items].sort((a,b) => a.term.localeCompare(b.term));
  return `
    <div class="lesson-header">
      <div class="eyebrow">Quick mental-model reference</div><h1>Kubernetes glossary</h1>
      <p class="hero-copy">Short definitions for the terms used throughout the labs. Search by term or by the idea you are trying to remember.</p>
    </div>
    <div class="glossary-tools panel"><input id="glossary-search" type="search" placeholder="Search Pod, reconciliation, storage, identity…" aria-label="Search Kubernetes glossary"><span class="badge" id="glossary-count">${sorted.length} terms</span></div>
    <div class="glossary-grid" id="glossary-grid">
      ${sorted.map(item => `<article class="glossary-item" data-glossary data-search="${`${item.term} ${item.definition}`.toLowerCase().replaceAll('"','&quot;')}"><h3>${item.term}</h3><p>${item.definition}</p></article>`).join('')}
    </div>
    <div class="panel filter-empty" id="glossary-empty"><h2>No glossary match</h2><p class="hero-copy">Try a subsystem name such as scheduler, API, storage, network, or workload.</p></div>`;
}

export function bindGlossarySearch(root = document) {
  const input = root.querySelector('#glossary-search');
  const count = root.querySelector('#glossary-count');
  const empty = root.querySelector('#glossary-empty');
  if (!input) return;
  const apply = () => {
    const query = input.value.trim().toLowerCase();
    let visible = 0;
    root.querySelectorAll('[data-glossary]').forEach(item => {
      const show = !query || (item.dataset.search || '').includes(query);
      item.classList.toggle('filtered-out', !show);
      if (show) visible++;
    });
    if (count) count.textContent = `${visible} term${visible === 1 ? '' : 's'}`;
    if (empty) empty.classList.toggle('visible', visible === 0);
  };
  input.addEventListener('input', apply);
  apply();
}
