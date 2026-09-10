import { curriculum, lessonLoaders, findLesson } from './catalog.js';
import {
  completedLessons,
  markLessonComplete,
  progressSnapshot,
  allAchievements,
  prereqState,
  awardChallenge,
  exportProgress,
  importProgress,
  resetProgress
} from './gamification.js';
import { lessonDescription } from './data/lesson-descriptions.js';
import { lessonResources, SITE_META } from './data/lesson-resources.js';
import { GLOSSARY } from './data/glossary.js';
import { LEARNING_TRACKS } from './data/learning-tracks.js';
import {
  bindSectionCollapsers,
  bindMobileNav,
  bindCurriculumFilters,
  isSectionCollapsed,
  showToast
} from './ui/learning-ui.js';
import { renderTracksPage, renderGlossaryPage, bindGlossarySearch } from './ui/content-pages.js';

const app = document.querySelector('#app');
const state = { currentLesson: null };

function allLessons() {
  return curriculum.flatMap(section => section.lessons.map(lesson => ({ ...lesson, section })));
}

function readyLessons() {
  return allLessons().filter(lesson => lesson.status === 'ready');
}

function readyCount() { return readyLessons().length; }
function titleFor(id) { return findLesson(id)?.title || id; }

function escapeAttr(value = '') {
  return String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

function recommendedLesson(completed, excludeId = null) {
  const lessons = readyLessons().filter(lesson => lesson.id !== excludeId && !completed.has(lesson.id));
  return lessons.find(lesson => prereqState(lesson.id, completed).met) || lessons[0] || null;
}

function levelProgress(progress) {
  if (!progress.next) return 100;
  const span = progress.next.min - progress.current.min;
  return Math.max(0, Math.min(100, ((progress.xp - progress.current.min) / span) * 100));
}

function pageHash(page) {
  const map = { home:'#/', progress:'#/progress', tracks:'#/tracks', glossary:'#/glossary' };
  return map[page] || '#/';
}

function progressPanel(progress, recommended) {
  const achievements = allAchievements();
  const unlocked = new Set(progress.unlocked.map(item => item.id));
  const nextText = progress.next ? `${progress.next.min - progress.xp} XP to ${progress.next.name}` : 'Highest rank reached';
  return `
    <section class="panel" style="margin-top:18px">
      <div class="section-head" style="margin:0 0 16px">
        <div><div class="eyebrow">Your learning journey</div><h2>Level ${progress.current.level} · ${progress.current.name}</h2></div>
        <div class="chip-row">
          ${recommended ? `<button class="primary-btn" data-lesson="${recommended.id}">Continue → ${recommended.title}</button>` : '<span class="badge">Curriculum complete 🏆</span>'}
          <button class="chip-btn" data-page="progress">View progress</button>
        </div>
      </div>
      <div class="grid-3">
        <div class="metric"><span>Total XP</span><strong>${progress.xp}</strong><p style="color:var(--muted);font-size:12px">${progress.lessonXP} lesson XP + ${progress.bonusXP} challenge XP</p></div>
        <div class="metric"><span>Lessons complete</span><strong>${progress.completed.size}/${readyCount()}</strong><p style="color:var(--muted);font-size:12px">${progress.percent}% of the live curriculum</p></div>
        <div class="metric"><span>Achievements</span><strong>${progress.unlocked.length}/${achievements.length}</strong><p style="color:var(--muted);font-size:12px">${nextText}</p></div>
      </div>
      <div style="margin-top:14px"><div class="node-row"><span>Rank progress</span><span>${Math.round(levelProgress(progress))}%</span></div><div class="bar quota"><i style="width:${levelProgress(progress)}%"></i></div></div>
      <div class="chip-row" style="margin-top:16px">${achievements.map(item => `<span class="badge" style="opacity:${unlocked.has(item.id)?1:.38}" title="${item.detail}">${item.icon} ${item.title}</span>`).join('')}</div>
    </section>`;
}

function shell(content, activeId = null, activePage = null) {
  const completed = completedLessons();
  const progress = progressSnapshot(readyCount());
  return `
    <div class="shell">
      <header class="topbar">
        <div class="chip-row" style="align-items:center">
          <button class="ghost-btn mobile-nav-toggle" data-mobile-nav-toggle aria-label="Open curriculum" aria-expanded="false">☰</button>
          <a class="brand" href="#/"><span class="brand-mark">⎈</span><span>Learn Kubernetes<small>See it. Break it. Understand it.</small></span></a>
        </div>
        <div class="top-actions">
          <button class="ghost-btn hide-sm ${activePage === 'tracks' ? 'active' : ''}" data-page="tracks">Tracks</button>
          <button class="ghost-btn hide-sm ${activePage === 'glossary' ? 'active' : ''}" data-page="glossary">Glossary</button>
          <button class="ghost-btn ${activePage === 'progress' ? 'active' : ''}" data-page="progress">Progress</button>
          <span class="badge version-pill hide-sm">Validated · K8s ${SITE_META.kubernetesBaseline}</span>
          <span class="badge hide-sm">L${progress.current.level} · ${progress.xp} XP</span>
          <a class="ghost-btn" href="https://github.com/chitender/learn-k8s" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar" aria-label="Curriculum navigation">
          <div class="sidebar-tools">
            <button class="ghost-btn" data-page="home">⌂ Learning home</button>
            <button class="ghost-btn" data-page="tracks">🧭 Learning tracks</button>
            <button class="ghost-btn" data-page="glossary">⌘ Kubernetes glossary</button>
            <button class="ghost-btn" data-page="progress">🏆 Progress & achievements</button>
          </div>
          <div class="sidebar-label">Learning path</div>
          ${curriculum.map(section => {
            const collapsed = isSectionCollapsed(section.id);
            const sectionDone = section.lessons.filter(lesson => completed.has(lesson.id)).length;
            return `
              <div class="nav-section ${collapsed?'collapsed':''}" data-nav-section="${section.id}">
                <button class="nav-section-toggle" data-section-toggle="${section.id}" aria-expanded="${collapsed?'false':'true'}">
                  <span>${section.title} <small style="color:var(--muted)">${sectionDone}/${section.lessons.length}</small></span><span class="chevron">⌄</span>
                </button>
                <div class="nav-lessons">
                  ${section.lessons.map(lesson => {
                    const done = completed.has(lesson.id);
                    return `<button class="nav-link ${activeId===lesson.id?'active':''}" data-lesson="${lesson.id}"><span>${done?'✓ ':''}${lesson.title}</span>${done?'<span class="badge">+100</span>':'<i class="status-dot status-ready"></i>'}</button>`;
                  }).join('')}
                </div>
              </div>`;
          }).join('')}
        </aside>
        <div class="sidebar-backdrop"></div>
        <main class="main" id="main-content" tabindex="-1"><div class="container">${content}</div></main>
      </div>
    </div>`;
}

function curriculumControls() {
  return `
    <div class="curriculum-tools">
      <div class="search-wrap"><input id="lesson-search" type="search" placeholder="Search CPU, CNI, selectors, RBAC, StatefulSet, etcd…" aria-label="Search lessons"></div>
      <select id="lesson-level-filter" aria-label="Filter by level"><option>All</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>
      <select id="lesson-status-filter" aria-label="Filter by completion"><option value="All">All progress</option><option value="incomplete">Not completed</option><option value="complete">Completed</option></select>
      <div class="filter-summary"><span id="filter-summary-text">${readyCount()} lessons shown</span><span>Press / to focus search</span></div>
    </div>`;
}

function home() {
  const completed = completedLessons();
  const progress = progressSnapshot(readyCount());
  const recommended = recommendedLesson(completed);
  const cards = curriculum.map(section => `
    <section class="curriculum-section" data-curriculum-section="${section.id}">
      <div class="section-head"><div><div class="eyebrow">${section.title}</div><h2>${section.description}</h2></div></div>
      <div class="curriculum-grid">
        ${section.lessons.map(lesson => {
          const gate = prereqState(lesson.id, completed);
          const done = completed.has(lesson.id);
          const missing = gate.missing.slice(0,2).map(titleFor).join(', ');
          const search = escapeAttr(`${lesson.title} ${lessonDescription(lesson.id)} ${section.title} ${section.description} ${lesson.level}`.toLowerCase());
          return `<button class="lesson-card" data-lesson="${lesson.id}" data-searchable-lesson data-search="${search}" data-level="${lesson.level}" data-completion="${done?'complete':'incomplete'}">
            <div class="card-top"><span class="badge">${lesson.level}</span><span class="badge">${done?'✓ Complete':`${lesson.minutes} min · +100 XP`}</span></div>
            <h3>${lesson.title}</h3><p>${lessonDescription(lesson.id)}</p>
            <div class="go">${done?'Review lesson ↻':gate.met?'Start interactive lesson →':`Suggested first: ${missing}${gate.missing.length>2?'…':''}`}</div>
          </button>`;
        }).join('')}
      </div>
    </section>`).join('');

  app.innerHTML = shell(`
    <section class="hero">
      <div>
        <div class="eyebrow">Interactive Kubernetes fundamentals → production mastery</div>
        <h1>Stop memorizing.<br>Build the mental model.</h1>
        <p class="hero-copy">Learn by changing the system, breaking it, reading the evidence and explaining why Kubernetes behaved that way.</p>
        <div class="chip-row" style="margin-top:22px">
          <button class="primary-btn" data-lesson="${recommended?.id || 'why-kubernetes'}">${progress.completed.size ? 'Continue learning →' : 'Start the learning path →'}</button>
          <button class="chip-btn" data-page="tracks">🧭 Choose a track</button>
          <button class="chip-btn" data-lesson="challenge-arena">⚔ Challenge Arena</button>
          <button class="chip-btn" data-lesson="cluster-sandbox">🧪 Cluster Sandbox</button>
        </div>
        <div class="resource-links"><span class="badge version-pill">Baseline: Kubernetes ${SITE_META.kubernetesBaseline}</span><span class="badge">Validated ${SITE_META.validatedAt}</span><span class="badge">${readyCount()} interactive labs</span></div>
      </div>
      <div class="hero-card"><div class="terminal"><div class="cyan">LEVEL ${progress.current.level}</div><div class="green">${progress.current.name}</div><br><div>${progress.xp} XP earned</div><div>${progress.completed.size}/${readyCount()} labs completed</div><div>${progress.unlocked.length}/${allAchievements().length} achievements unlocked</div><br><div class="amber"># Next recommended</div><div>${recommended ? recommended.title : 'Curriculum complete 🏆'}</div></div></div>
    </section>
    ${progressPanel(progress, recommended)}
    ${curriculumControls()}
    <div id="filter-empty" class="panel filter-empty"><div class="eyebrow">No match</div><h2>Try a broader search</h2><p class="hero-copy">Search by terms such as scheduler, network, storage, runtime, security, CPU, probes, selectors, or etcd.</p></div>
    ${cards}
    <div class="footer-note">Progress stays in your browser via localStorage. No account or backend is required. Core content baseline: Kubernetes ${SITE_META.kubernetesBaseline}.</div>
  `);
  bindGlobalNavigation();
  bindCurriculumFilters(document);
}

function sectionProgressRows(completed) {
  return curriculum.map(section => {
    const done = section.lessons.filter(lesson => completed.has(lesson.id)).length;
    const percent = Math.round((done / section.lessons.length) * 100);
    return `<div class="section-progress-row"><strong>${section.title}</strong><div class="bar req"><i style="width:${percent}%"></i></div><span class="badge">${done}/${section.lessons.length}</span></div>`;
  }).join('');
}

function progressPage() {
  const progress = progressSnapshot(readyCount());
  const achievements = allAchievements();
  const unlocked = new Set(progress.unlocked.map(item => item.id));
  const recommended = recommendedLesson(progress.completed);
  const exported = exportProgress();

  app.innerHTML = shell(`
    <div class="lesson-header"><div class="eyebrow">Learner profile</div><h1>Progress & achievements</h1><p class="hero-copy">Your learning state stays on this device. Back it up, move it to another browser, or reset it whenever you want.</p></div>
    <div class="progress-hero">
      <div class="panel">
        <div class="eyebrow">Current rank</div><h2>Level ${progress.current.level} · ${progress.current.name}</h2>
        <div class="grid-3" style="margin-top:16px"><div class="metric"><span>XP</span><strong>${progress.xp}</strong></div><div class="metric"><span>Lessons</span><strong>${progress.completed.size}/${readyCount()}</strong></div><div class="metric"><span>Complete</span><strong>${progress.percent}%</strong></div></div>
        <div style="margin-top:16px"><div class="node-row"><span>Rank progress</span><span>${Math.round(levelProgress(progress))}%</span></div><div class="bar quota"><i style="width:${levelProgress(progress)}%"></i></div></div>
        ${recommended ? `<button class="primary-btn" data-lesson="${recommended.id}" style="margin-top:18px">Continue → ${recommended.title}</button>` : '<div class="callout success"><strong>Curriculum complete 🏆</strong><p>You have completed every live lesson.</p></div>'}
      </div>
      <div class="panel"><div class="eyebrow">XP breakdown</div><div class="metric" style="margin-top:12px"><span>Lesson XP</span><strong>${progress.lessonXP}</strong></div><div class="metric" style="margin-top:10px"><span>Challenge bonus XP</span><strong>${progress.bonusXP}</strong></div><div class="callout"><strong>Progress is portable</strong><p>Use the backup below to move your progress between browsers or devices without creating an account.</p></div></div>
    </div>

    <section style="margin-top:28px"><div class="section-head"><div><div class="eyebrow">Achievements</div><h2>${progress.unlocked.length}/${achievements.length} unlocked</h2></div></div><div class="achievement-grid">${achievements.map(item => `<div class="achievement-card ${unlocked.has(item.id)?'':'locked'}"><div class="achievement-icon">${item.icon}</div><strong>${item.title}</strong><p style="color:var(--muted);font-size:12px">${item.detail}</p><span class="badge">${unlocked.has(item.id)?'Unlocked':'Locked'}</span></div>`).join('')}</div></section>

    <section class="panel" style="margin-top:28px"><div class="eyebrow">Curriculum coverage</div><h2>Progress by section</h2><div class="section-progress-list" style="margin-top:18px">${sectionProgressRows(progress.completed)}</div></section>

    <section style="margin-top:28px"><div class="section-head"><div><div class="eyebrow">Backup & restore</div><h2>Own your learning state</h2></div></div><div class="progress-io">
      <div class="panel"><h3>Export</h3><p style="color:var(--muted)">Copy or download this versioned JSON backup.</p><textarea id="progress-export" readonly>${exported}</textarea><div class="chip-row" style="margin-top:12px"><button class="primary-btn" id="copy-progress">Copy JSON</button><button class="chip-btn" id="download-progress">Download backup</button></div></div>
      <div class="panel"><h3>Import</h3><p style="color:var(--muted)">Paste a Learn Kubernetes progress backup. Unknown lesson IDs are ignored.</p><textarea id="progress-import" placeholder="Paste learn-k8s-progress JSON here…"></textarea><div class="chip-row" style="margin-top:12px"><button class="primary-btn" id="import-progress">Import progress</button><button class="danger-btn" id="reset-progress">Reset all progress</button></div></div>
    </div></section>
  `, null, 'progress');
  bindGlobalNavigation();
  bindProgressActions(exported);
}

function tracksPage() {
  app.innerHTML = shell(renderTracksPage({ tracks:LEARNING_TRACKS, completed:completedLessons(), findLesson }), null, 'tracks');
  bindGlobalNavigation();
}

function glossaryPage() {
  app.innerHTML = shell(renderGlossaryPage(GLOSSARY), null, 'glossary');
  bindGlobalNavigation();
  bindGlossarySearch(document);
}

function bindProgressActions(exported) {
  const copy = document.querySelector('#copy-progress');
  const download = document.querySelector('#download-progress');
  const importButton = document.querySelector('#import-progress');
  const resetButton = document.querySelector('#reset-progress');

  copy?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exported);
      showToast('Progress JSON copied.');
    } catch {
      const box = document.querySelector('#progress-export');
      box?.focus(); box?.select();
      showToast('Select and copy the highlighted JSON.');
    }
  });

  download?.addEventListener('click', () => {
    const blob = new Blob([exported], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'learn-k8s-progress.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Progress backup downloaded.');
  });

  importButton?.addEventListener('click', () => {
    const raw = document.querySelector('#progress-import')?.value || '';
    try {
      const result = importProgress(raw, readyLessons().map(lesson => lesson.id));
      showToast(`Imported ${result.completed} completed lessons.`);
      progressPage();
    } catch (error) {
      showToast(error.message || 'Could not import progress.');
    }
  });

  resetButton?.addEventListener('click', () => {
    if (!window.confirm('Reset all Learn Kubernetes lesson and challenge progress on this browser?')) return;
    resetProgress();
    showToast('Learning progress reset.');
    progressPage();
  });
}

function referenceLinks(id) {
  const resources = lessonResources(id);
  if (!resources.length) return '';
  return `<div class="resource-links">${resources.map(resource => `<a class="resource-link" href="${resource.url}" target="_blank" rel="noreferrer">Official reference ↗ ${resource.label}</a>`).join('')}</div>`;
}

async function lessonPage(id) {
  const lesson = findLesson(id);
  if (!lesson || lesson.status !== 'ready' || !lessonLoaders[id]) { location.hash = '#/'; return; }
  const completed = completedLessons();
  const gate = prereqState(id, completed);
  const prereqText = gate.met ? 'Recommended prerequisites met' : `Suggested first: ${gate.missing.map(titleFor).join(', ')}`;

  app.innerHTML = shell(`
    <div class="lesson-header">
      <div class="breadcrumb"><a href="#/">Learning path</a> / ${lesson.section.title}</div>
      <div class="lesson-meta"><span class="badge">${lesson.level}</span><span class="badge">${lesson.minutes} min</span><span class="badge">+100 XP</span><span class="badge version-pill">K8s ${SITE_META.kubernetesBaseline} baseline</span></div>
      <h1>${lesson.title}</h1><p class="hero-copy">${lessonDescription(id)}</p>
      <div class="callout ${gate.met?'success':'warn'}"><strong>${prereqText}</strong><p>${gate.met?'You have the recommended context for this lab.':'Nothing is locked. You can continue here, or open the suggested lessons first.'}</p></div>
      ${referenceLinks(id)}
    </div>
    <div id="lesson-root"><div class="panel">Loading interactive lab…</div></div>
    <div id="lesson-reward"></div>
  `, id);
  bindGlobalNavigation();

  const root = document.querySelector('#lesson-root');
  try {
    const module = await lessonLoaders[id]();
    state.currentLesson = module;
    if (typeof module.mount !== 'function') throw new Error('Lesson module does not export mount().');
    module.mount(root, {
      markComplete: () => {
        const fresh = markLessonComplete(id);
        const button = document.querySelector('[data-mark-complete]');
        if (button) { button.textContent = fresh ? '✓ Completed · +100 XP' : '✓ Lesson completed'; button.disabled = true; }
        const progress = progressSnapshot(readyCount());
        const next = recommendedLesson(progress.completed, id);
        const reward = document.querySelector('#lesson-reward');
        if (reward) reward.innerHTML = `<div class="panel" style="margin-top:16px"><div class="eyebrow">${fresh?'XP earned':'Lesson reviewed'}</div><h2>${fresh?'+100 XP · ':''}${progress.current.name}</h2><p class="hero-copy">You now have ${progress.xp} XP and ${progress.completed.size}/${readyCount()} lessons completed.</p>${next?`<button class="primary-btn" data-lesson="${next.id}">Recommended next → ${next.title}</button>`:'<div class="callout success"><strong>Curriculum complete 🏆</strong><p>You have completed every live lesson.</p></div>'}</div>`;
        bindGlobalNavigation();
      },
      awardXP: (key, amount) => awardChallenge(key, amount)
    });
  } catch (error) {
    console.error('Lesson failed to load', id, error);
    root.innerHTML = `<div class="panel"><div class="eyebrow">Lesson load error</div><h2>This lab could not start.</h2><p class="hero-copy">The rest of the site is still available. Reload the page; if it persists, the automated repository validator should catch the wiring problem on the next change.</p><div class="terminal">${escapeAttr(error?.message || String(error))}</div><div class="chip-row" style="margin-top:14px"><button class="primary-btn" onclick="location.reload()">Reload</button><button class="chip-btn" data-page="home">Back to curriculum</button></div></div>`;
    bindGlobalNavigation();
  }
}

function bindGlobalNavigation() {
  document.querySelectorAll('[data-lesson]').forEach(element => {
    if (element.dataset.bound === '1') return;
    element.dataset.bound = '1';
    element.addEventListener('click', () => {
      const lesson = findLesson(element.dataset.lesson);
      if (!lesson || lesson.status !== 'ready') return;
      location.hash = `#/learn/${lesson.id}`;
    });
  });

  document.querySelectorAll('[data-page]').forEach(element => {
    if (element.dataset.pageBound === '1') return;
    element.dataset.pageBound = '1';
    element.addEventListener('click', () => { location.hash = pageHash(element.dataset.page); });
  });

  bindSectionCollapsers(document);
  bindMobileNav(document);
}

function focusMain() {
  requestAnimationFrame(() => {
    const main = document.querySelector('#main-content');
    if (main) main.focus({ preventScroll:true });
    window.scrollTo({ top:0, behavior:'auto' });
  });
}

function route() {
  if (state.currentLesson?.unmount) state.currentLesson.unmount();
  state.currentLesson = null;

  if (location.hash === '#/progress') { document.title = 'Progress — Learn Kubernetes'; progressPage(); focusMain(); return; }
  if (location.hash === '#/tracks') { document.title = 'Learning Tracks — Learn Kubernetes'; tracksPage(); focusMain(); return; }
  if (location.hash === '#/glossary') { document.title = 'Glossary — Learn Kubernetes'; glossaryPage(); focusMain(); return; }

  const match = location.hash.match(/^#\/learn\/([a-z0-9-]+)$/);
  if (match) {
    const lesson = findLesson(match[1]);
    document.title = `${lesson?.title || 'Lesson'} — Learn Kubernetes`;
    lessonPage(match[1]);
  } else {
    document.title = 'Learn Kubernetes — Interactive Fundamentals to Production';
    home();
  }
  focusMain();
}

window.addEventListener('hashchange', route);
route();
