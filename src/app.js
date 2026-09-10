import { curriculum, lessonLoaders, findLesson } from './catalog.js';

const app = document.querySelector('#app');
const state = { currentLesson: null };

function lessonDescription(id) {
  const descriptions = {
    'why-kubernetes': 'Start with the operational problems Kubernetes solves: failures, scaling, releases and service discovery — before learning the objects.',
    'cluster-architecture': 'Follow a Pod create request through the API server, etcd, controllers, scheduler, kubelet and container runtime — then break components to see what stops.',
    'declarative-model': 'Create drift between desired and actual state, then run a reconciliation loop and see why controllers are the heart of Kubernetes.',
    'pods': 'Learn what a Pod really is, what containers inside it share, and why individual Pod IPs should be treated as replaceable.',
    'deployments': 'Create drift on purpose, watch reconciliation restore desired state, and step through a rolling update between ReplicaSets.',
    'pod-lifecycle': 'Break readiness, liveness and startup probes independently to see how traffic admission and container restarts are different decisions.',
    'cpu-scheduling': 'See exactly how kube-scheduler placement and Linux cgroup CPU enforcement differ — then reproduce throttling yourself.',
    'memory': 'Compare memory requests with runtime limits and see why memory pressure can lead to OOM killing instead of CPU-style throttling.',
    'services': 'Toggle backend readiness, send requests through a Service, resolve cross-namespace DNS names, and compare Service exposure types.',
    'pv-pvc': 'Provision storage through a PVC, bind a PV, attach a Pod, and understand why persistent storage has a different lifecycle than Pods.',
    'kubectl-debug': 'Practice a repeatable symptom → evidence troubleshooting flow for Pending, CrashLoopBackOff, ImagePullBackOff and broken Services.'
  };
  return descriptions[id] || 'Interactive lesson coming soon.';
}

function allLessons() {
  return curriculum.flatMap((section) => section.lessons.map((lesson) => ({ ...lesson, section })));
}

function readyCount() {
  return allLessons().filter((lesson) => lesson.status === 'ready').length;
}

function completedSet() {
  try { return new Set(JSON.parse(localStorage.getItem('learn-k8s-completed') || '[]')); }
  catch { return new Set(); }
}

function saveCompleted(id) {
  const set = completedSet();
  set.add(id);
  localStorage.setItem('learn-k8s-completed', JSON.stringify([...set]));
}

function shell(content, activeId = null) {
  return `
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="#/">
          <span class="brand-mark">⎈</span>
          <span>Learn Kubernetes<small>See it. Break it. Understand it.</small></span>
        </a>
        <div class="top-actions">
          <span class="badge hide-sm">${readyCount()} interactive module${readyCount() === 1 ? '' : 's'} live</span>
          <a class="ghost-btn" href="https://github.com/chitender/learn-k8s" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-label">Learning path</div>
          ${curriculum.map((section) => `
            <div class="nav-section">
              <div class="nav-section-title">${section.title}</div>
              ${section.lessons.map((lesson) => `
                <button class="nav-link ${activeId === lesson.id ? 'active' : ''}" data-lesson="${lesson.id}" ${lesson.status !== 'ready' ? 'title="Coming soon"' : ''}>
                  <span>${lesson.title}</span>
                  <i class="status-dot status-${lesson.status}"></i>
                </button>
              `).join('')}
            </div>
          `).join('')}
        </aside>
        <main class="main"><div class="container">${content}</div></main>
      </div>
    </div>`;
}

function home() {
  const completed = completedSet();
  const cards = curriculum.map((section) => `
    <section>
      <div class="section-head">
        <div><div class="eyebrow">${section.title}</div><h2>${section.description}</h2></div>
      </div>
      <div class="curriculum-grid">
        ${section.lessons.map((lesson) => `
          <button class="lesson-card" data-lesson="${lesson.id}" ${lesson.status !== 'ready' ? 'disabled' : ''}>
            <div class="card-top">
              <span class="badge">${lesson.level}</span>
              <span class="badge">${lesson.minutes} min</span>
            </div>
            <h3>${completed.has(lesson.id) ? '✓ ' : ''}${lesson.title}</h3>
            <p>${lessonDescription(lesson.id)}</p>
            <div class="go">${lesson.status === 'ready' ? 'Start interactive lesson →' : 'Coming soon'}</div>
          </button>
        `).join('')}
      </div>
    </section>`).join('');

  app.innerHTML = shell(`
    <section class="hero">
      <div>
        <div class="eyebrow">Interactive Kubernetes fundamentals</div>
        <h1>Stop memorizing.<br>Build the mental model.</h1>
        <p class="hero-copy">A visual playground for beginners who want to understand what Kubernetes is actually doing — from API objects and scheduling to networking, storage and troubleshooting.</p>
        <div class="chip-row" style="margin-top:22px">
          <button class="primary-btn" data-lesson="why-kubernetes">Start the learning path →</button>
          <span class="badge">No cluster required</span><span class="badge">GitHub Pages friendly</span>
        </div>
      </div>
      <div class="hero-card">
        <div class="terminal">
          <div><span class="green">$</span> kubectl apply -f app.yaml</div>
          <div class="cyan">deployment.apps/web created</div><br>
          <div class="amber"># What happens after this?</div>
          <div># API server → controller → scheduler → kubelet</div>
          <div># then Linux cgroups, networking and storage</div><br>
          <div class="green">Learn the mechanism, not the command list →</div>
        </div>
      </div>
    </section>
    ${cards}
    <div class="footer-note">Built as a growing open learning platform. Each lesson should explain the “why”, visualize the mechanism, and let you experiment.</div>
  `);
  bindGlobalNavigation();
}

async function lessonPage(id) {
  const lesson = findLesson(id);
  if (!lesson || lesson.status !== 'ready' || !lessonLoaders[id]) {
    location.hash = '#/';
    return;
  }

  app.innerHTML = shell(`
    <div class="lesson-header">
      <div class="breadcrumb"><a href="#/">Learning path</a> / ${lesson.section.title}</div>
      <div class="eyebrow">${lesson.level} · ${lesson.minutes} min</div>
      <h1>${lesson.title}</h1>
      <p class="hero-copy">${lessonDescription(id)}</p>
    </div>
    <div id="lesson-root"><div class="panel">Loading interactive lab…</div></div>
  `, id);
  bindGlobalNavigation();

  const module = await lessonLoaders[id]();
  state.currentLesson = module;
  const root = document.querySelector('#lesson-root');
  module.mount(root, {
    markComplete: () => {
      saveCompleted(id);
      const btn = document.querySelector('[data-mark-complete]');
      if (btn) { btn.textContent = '✓ Lesson completed'; btn.disabled = true; }
    }
  });
}

function bindGlobalNavigation() {
  document.querySelectorAll('[data-lesson]').forEach((el) => {
    el.addEventListener('click', () => {
      const lesson = findLesson(el.dataset.lesson);
      if (!lesson || lesson.status !== 'ready') return;
      location.hash = `#/learn/${lesson.id}`;
    });
  });
}

function route() {
  if (state.currentLesson?.unmount) state.currentLesson.unmount();
  state.currentLesson = null;
  const match = location.hash.match(/^#\/learn\/([a-z0-9-]+)$/);
  if (match) lessonPage(match[1]); else home();
}

window.addEventListener('hashchange', route);
route();