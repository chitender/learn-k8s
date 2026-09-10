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
    'affinity-taints': 'Build placement rules with labels, node affinity, taints and tolerations, then deliberately create an unschedulable Pod.',
    'priority-preemption': 'Create a resource conflict and see when a higher-priority Pod can trigger preemption of lower-priority Pods to make room.',
    'topology-spread': 'Spread replicas across failure domains, change maxSkew, remove a zone and see when hard topology constraints leave Pods Pending.',
    'scheduler-framework': 'Walk through Filter, Score, Reserve, Permit and Bind while toggling scheduler plugins to see how one placement decision is assembled.',
    'pod-networking': 'Trace Pod-to-Pod traffic across same-Pod, same-node and cross-node paths while separating Kubernetes networking guarantees from CNI implementation details.',
    'services': 'Toggle backend readiness, send requests through a Service, resolve cross-namespace DNS names, and compare Service exposure types.',
    'service-internals': 'Trace ClusterIP traffic through EndpointSlice state and compare how kube-proxy backends implement the same Service API.',
    'dns-ingress': 'Follow a request from DNS to an Ingress controller, Service and Ready endpoint, and see why an Ingress object alone does not route traffic.',
    'volumes': 'Experiment with emptyDir, ConfigMap and PVC-backed mounts to learn exactly which data survives a container restart or Pod replacement.',
    'pv-pvc': 'Provision storage through a PVC, bind a PV, attach a Pod, and understand why persistent storage has a different lifecycle than Pods.',
    'kubectl-debug': 'Practice a repeatable symptom → evidence troubleshooting flow for Pending, CrashLoopBackOff, ImagePullBackOff and broken Services.',
    'events-logs-metrics': 'Choose the fastest signal for a symptom and practice correlating Kubernetes events, container logs and metrics instead of guessing.',
    'autoscaling': 'Simulate HPA replica math, VPA rightsizing and node autoscaling to see how requests connect workload demand to schedulable cluster capacity.',
    'node-pressure-eviction': 'Push simulated memory or filesystem availability across kubelet eviction thresholds and see why node-pressure eviction is different from API eviction.',
    'configmaps-secrets': 'Change configuration live and compare environment-variable vs projected-volume consumption while learning why base64 does not equal encryption.',
    'namespaces-rbac': 'Ask “can this identity do this verb on this resource in this namespace?” and learn Role, ClusterRole and least-privilege thinking.',
    'serviceaccounts-tokens': 'Give a Pod an API identity, expire a projected token, and separate authentication from the RBAC authorization decision.',
    'quotas-limits': 'Submit Pods against a simulated LimitRange and ResourceQuota to separate admission policy from scheduler node placement.',
    'jobs-cronjobs': 'Run finite work to completion, change parallelism, inject failures and experiment with CronJob concurrency policies.',
    'statefulsets': 'Delete and recreate stable Pod ordinals, scale replicas and watch persistent identity stay attached to each StatefulSet member.',
    'daemonsets': 'Add nodes and change eligibility rules to see why DaemonSets derive desired Pods from nodes instead of a replica count.',
    'pdb-termination': 'Try voluntary evictions against a PDB and step through graceful Pod termination from serving traffic to clean exit.',
    'networkpolicy': 'Start with open east-west traffic, introduce isolation, then add explicit allows and observe which application flows survive.',
    'pod-security-admission': 'Change namespace Pod Security levels and enforcement modes, then test Pods that violate baseline or restricted expectations.',
    'helm': 'Render a simplified chart from values and templates while keeping the boundary clear: Helm packages manifests; Kubernetes reconciles them.',
    'production-capstone': 'Assemble a production-style workload from Deployments, Services, probes, resources, PDBs, NetworkPolicies, autoscaling and storage decisions.',
    'admission-control': 'Send a Pod CREATE through mutation and validation, break an external webhook, and see how failurePolicy changes API behavior.',
    'crds-operators': 'Install a custom API type, create drift and watch a custom controller reconcile desired state like a domain-specific Kubernetes operator.'
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
        <p class="hero-copy">A visual playground for beginners who want to understand what Kubernetes is actually doing — from API objects and scheduling to networking, storage, security, reliability and control-plane internals.</p>
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
          <div># AuthN/AuthZ → admission → persistence</div>
          <div># controllers → scheduler → kubelet → Linux</div><br>
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