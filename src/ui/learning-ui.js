const COLLAPSED_KEY = 'learn-k8s-collapsed-sections';

function readCollapsed() {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveCollapsed(set) {
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set]));
}

export function isSectionCollapsed(id) {
  return readCollapsed().has(id);
}

export function bindSectionCollapsers(root = document) {
  root.querySelectorAll('[data-section-toggle]').forEach(button => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      const sectionId = button.dataset.sectionToggle;
      const section = root.querySelector(`[data-nav-section="${sectionId}"]`);
      if (!section) return;
      const collapsed = readCollapsed();
      if (collapsed.has(sectionId)) collapsed.delete(sectionId); else collapsed.add(sectionId);
      saveCollapsed(collapsed);
      section.classList.toggle('collapsed', collapsed.has(sectionId));
      button.setAttribute('aria-expanded', collapsed.has(sectionId) ? 'false' : 'true');
    });
  });
}

export function bindMobileNav(root = document) {
  const toggle = root.querySelector('[data-mobile-nav-toggle]');
  const sidebar = root.querySelector('.sidebar');
  const backdrop = root.querySelector('.sidebar-backdrop');
  if (!toggle || !sidebar || !backdrop || toggle.dataset.mobileBound === '1') return;
  toggle.dataset.mobileBound = '1';

  const close = () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
    toggle.setAttribute('aria-expanded','false');
  };
  const open = () => {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
    toggle.setAttribute('aria-expanded','true');
  };

  toggle.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
  backdrop.addEventListener('click', close);
  sidebar.querySelectorAll('[data-lesson],[data-page]').forEach(element => element.addEventListener('click', close));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) close();
  });
}

export function bindCurriculumFilters(root = document) {
  const query = root.querySelector('#lesson-search');
  const level = root.querySelector('#lesson-level-filter');
  const status = root.querySelector('#lesson-status-filter');
  const summary = root.querySelector('#filter-summary-text');
  const empty = root.querySelector('#filter-empty');
  if (!query || !level || !status || query.dataset.filterBound === '1') return;
  query.dataset.filterBound = '1';

  const apply = () => {
    const q = query.value.trim().toLowerCase();
    const wantedLevel = level.value;
    const wantedStatus = status.value;
    let visible = 0;

    root.querySelectorAll('[data-curriculum-section]').forEach(section => {
      let sectionVisible = 0;
      section.querySelectorAll('[data-searchable-lesson]').forEach(card => {
        const haystack = card.dataset.search || '';
        const levelValue = card.dataset.level || '';
        const statusValue = card.dataset.completion || 'incomplete';
        const matchQuery = !q || haystack.includes(q);
        const matchLevel = wantedLevel === 'All' || levelValue.includes(wantedLevel);
        const matchStatus = wantedStatus === 'All' || statusValue === wantedStatus;
        const show = matchQuery && matchLevel && matchStatus;
        card.classList.toggle('filtered-out', !show);
        if (show) { visible++; sectionVisible++; }
      });
      section.classList.toggle('filtered-out', sectionVisible === 0);
    });

    if (summary) summary.textContent = `${visible} lesson${visible === 1 ? '' : 's'} shown`;
    if (empty) empty.classList.toggle('visible', visible === 0);
  };

  query.addEventListener('input', apply);
  level.addEventListener('input', apply);
  status.addEventListener('input', apply);
  document.addEventListener('keydown', event => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (event.key === '/' && !typing) {
      event.preventDefault();
      query.focus();
    }
  });
  apply();
}

let toastTimer;
export function showToast(message) {
  let toast = document.querySelector('#learn-k8s-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'learn-k8s-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
