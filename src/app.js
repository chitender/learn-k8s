import { curriculum, lessonLoaders, findLesson } from './catalog.js';
import { completedLessons, markLessonComplete, progressSnapshot, allAchievements, prereqState, awardChallenge } from './gamification.js';

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
    'init-sidecars': 'Compare regular init containers with Kubernetes-native sidecars and see how startup ordering, readiness and Job completion differ.',
    'probes-deep-dive': 'Tune startup budgets and failure thresholds, then see how readiness removes traffic while liveness restarts unhealthy containers.',
    'rollout-strategies': 'Change maxSurge, maxUnavailable and readiness behavior to see why a Deployment rollout progresses, stalls or preserves availability.',
    'cpu-scheduling': 'See exactly how kube-scheduler placement and Linux cgroup CPU enforcement differ — then reproduce throttling yourself.',
    'memory': 'Compare memory requests with runtime limits and see why memory pressure can lead to OOM killing instead of CPU-style throttling.',
    'affinity-taints': 'Build placement rules with labels, node affinity, taints and tolerations, then deliberately create an unschedulable Pod.',
    'qos-eviction-ranking': 'Build BestEffort, Burstable and Guaranteed workloads and see how request usage and QoS influence node-pressure eviction risk.',
    'priority-preemption': 'Create a resource conflict and see when a higher-priority Pod can trigger preemption of lower-priority Pods to make room.',
    'topology-spread': 'Spread replicas across failure domains, change maxSkew, remove a zone and see when hard topology constraints leave Pods Pending.',
    'scheduler-framework': 'Walk through Filter, Score, Reserve, Permit and Bind while toggling scheduler plugins to see how one placement decision is assembled.',
    'pod-networking': 'Trace Pod-to-Pod traffic across same-Pod, same-node and cross-node paths while separating Kubernetes networking guarantees from CNI implementation details.',
    'cni-deep-dive': 'Trace sandbox networking through CNI/IPAM and node dataplane setup, then break routing or policy to isolate cross-node failures.',
    'services': 'Toggle backend readiness, send requests through a Service, resolve cross-namespace DNS names, and compare Service exposure types.',
    'service-internals': 'Trace ClusterIP traffic through EndpointSlice state and compare how kube-proxy backends implement the same Service API.',
    'dns-ingress': 'Follow a request from DNS to an Ingress controller, Service and Ready endpoint, and see why an Ingress object alone does not route traffic.',
    'volumes': 'Experiment with emptyDir, ConfigMap and PVC-backed mounts to learn exactly which data survives a container restart or Pod replacement.',
    'pv-pvc': 'Provision storage through a PVC, bind a PV, attach a Pod, and understand why persistent storage has a different lifecycle than Pods.',
    'csi-deep-dive': 'Follow PVC provisioning through CSI controller and node operations, then distinguish provisioning, attach and mount failures.',
    'kubectl-debug': 'Practice a repeatable symptom → evidence troubleshooting flow for Pending, CrashLoopBackOff, ImagePullBackOff and broken Services.',
    'events-logs-metrics': 'Choose the fastest signal for a symptom and practice correlating Kubernetes events, container logs and metrics instead of guessing.',
    'autoscaling': 'Simulate HPA replica math, VPA rightsizing and node autoscaling to see how requests connect workload demand to schedulable cluster capacity.',
    'node-pressure-eviction': 'Push simulated memory or filesystem availability across kubelet eviction thresholds and see why node-pressure eviction is different from API eviction.',
    'incident-simulator': 'Diagnose realistic latency, Pending, CNI, CSI and rollout incidents by collecting evidence before choosing the failing subsystem.',
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
    'crds-operators': 'Install a custom API type, create drift and watch a custom controller reconcile desired state like a domain-specific Kubernetes operator.',
    'apiserver-etcd': 'Trace API requests through authentication, authorization, admission and persistence while testing what happens when authoritative storage is unavailable.',
    'leases-leader-election': 'Advance node heartbeat time and fail a simulated leader to understand why Lease objects are used for lightweight coordination.',
    'kubelet-internals': 'Run a kubelet sync loop across volumes, sandbox networking, image pulls, runtime health and readiness to see where Pod startup can block.',
    'cri-runtime': 'Follow kubelet gRPC calls through CRI RuntimeService and ImageService, then break the runtime endpoint, sandbox or image pull.',
    'challenge-arena': 'Test your mental model with CKA-style fundamentals and SRE incident questions. Correct first-time solves earn bonus XP.',
    'cluster-sandbox': 'Change scheduling, node health, CNI reachability, readiness and CPU demand in one connected cluster simulation.'
  };
  return descriptions[id] || 'Interactive Kubernetes lesson.';
}

function allLessons() {
  return curriculum.flatMap(section => section.lessons.map(lesson => ({ ...lesson, section })));
}

function readyLessons() {
  return allLessons().filter(lesson => lesson.status === 'ready');
}

function readyCount() { return readyLessons().length; }

function titleFor(id) { return findLesson(id)?.title || id; }

function recommendedLesson(completed, excludeId = null) {
  const lessons = readyLessons().filter(l => l.id !== excludeId && !completed.has(l.id));
  return lessons.find(l => prereqState(l.id, completed).met) || lessons[0] || null;
}

function levelProgress(progress) {
  if (!progress.next) return 100;
  const span = progress.next.min - progress.current.min;
  return Math.max(0, Math.min(100, ((progress.xp - progress.current.min) / span) * 100));
}

function progressPanel(progress, recommended) {
  const all = allAchievements();
  const unlocked = new Set(progress.unlocked.map(a => a.id));
  const nextText = progress.next ? `${progress.next.min - progress.xp} XP to ${progress.next.name}` : 'Highest rank reached';
  return `
    <section class="panel" style="margin-top:18px">
      <div class="section-head" style="margin:0 0 16px"><div><div class="eyebrow">Your learning journey</div><h2>Level ${progress.current.level} · ${progress.current.name}</h2></div>${recommended ? `<button class="primary-btn" data-lesson="${recommended.id}">Continue → ${recommended.title}</button>` : '<span class="badge">Curriculum complete 🏆</span>'}</div>
      <div class="grid-3">
        <div class="metric"><span>Total XP</span><strong>${progress.xp}</strong><p style="color:var(--muted);font-size:12px">${progress.lessonXP} lesson XP + ${progress.bonusXP} challenge XP</p></div>
        <div class="metric"><span>Lessons complete</span><strong>${progress.completed.size}/${readyCount()}</strong><p style="color:var(--muted);font-size:12px">${progress.percent}% of the live curriculum</p></div>
        <div class="metric"><span>Achievements</span><strong>${progress.unlocked.length}/${all.length}</strong><p style="color:var(--muted);font-size:12px">${nextText}</p></div>
      </div>
      <div style="margin-top:14px"><div class="node-row"><span>Rank progress</span><span>${Math.round(levelProgress(progress))}%</span></div><div class="bar quota"><i style="width:${levelProgress(progress)}%"></i></div></div>
      <div class="chip-row" style="margin-top:16px">${all.map(a => `<span class="badge" style="opacity:${unlocked.has(a.id)?1:.38}" title="${a.detail}">${a.icon} ${a.title}</span>`).join('')}</div>
      <div class="callout" style="margin-top:16px"><strong>Prerequisites are guidance, not gates.</strong><p>The site recommends a sensible order, but every lab remains open. Experienced learners can jump directly to the subsystem they want.</p></div>
    </section>`;
}

function shell(content, activeId = null) {
  const completed = completedLessons();
  const progress = progressSnapshot(readyCount());
  return `
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="#/"><span class="brand-mark">⎈</span><span>Learn Kubernetes<small>See it. Break it. Understand it.</small></span></a>
        <div class="top-actions">
          <span class="badge hide-sm">L${progress.current.level} · ${progress.xp} XP</span>
          <span class="badge hide-sm">${progress.completed.size}/${readyCount()} complete</span>
          <a class="ghost-btn" href="https://github.com/chitender/learn-k8s" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-label">Learning path</div>
          ${curriculum.map(section => `
            <div class="nav-section"><div class="nav-section-title">${section.title}</div>
              ${section.lessons.map(lesson => {
                const done = completed.has(lesson.id);
                return `<button class="nav-link ${activeId===lesson.id?'active':''}" data-lesson="${lesson.id}"><span>${done?'✓ ':''}${lesson.title}</span>${done?'<span class="badge">+100</span>':'<i class="status-dot status-ready"></i>'}</button>`;
              }).join('')}
            </div>`).join('')}
        </aside>
        <main class="main"><div class="container">${content}</div></main>
      </div>
    </div>`;
}

function home() {
  const completed = completedLessons();
  const progress = progressSnapshot(readyCount());
  const recommended = recommendedLesson(completed);
  const cards = curriculum.map(section => `
    <section>
      <div class="section-head"><div><div class="eyebrow">${section.title}</div><h2>${section.description}</h2></div></div>
      <div class="curriculum-grid">
        ${section.lessons.map(lesson => {
          const gate = prereqState(lesson.id, completed);
          const done = completed.has(lesson.id);
          const missing = gate.missing.slice(0,2).map(titleFor).join(', ');
          return `<button class="lesson-card" data-lesson="${lesson.id}">
            <div class="card-top"><span class="badge">${lesson.level}</span><span class="badge">${done?'✓ Complete':`${lesson.minutes} min · +100 XP`}</span></div>
            <h3>${lesson.title}</h3><p>${lessonDescription(lesson.id)}</p>
            <div class="go">${done?'Review lesson ↻':gate.met?'Start interactive lesson →':`Suggested first: ${missing}${gate.missing.length>2?'…':''}`}</div>
          </button>`;
        }).join('')}
      </div>
    </section>`).join('');

  app.innerHTML = shell(`
    <section class="hero">
      <div><div class="eyebrow">Interactive Kubernetes fundamentals → production mastery</div><h1>Stop memorizing.<br>Build the mental model.</h1><p class="hero-copy">Learn by changing the system, breaking it, reading the evidence and explaining why Kubernetes behaved that way.</p><div class="chip-row" style="margin-top:22px"><button class="primary-btn" data-lesson="${recommended?.id || 'why-kubernetes'}">${progress.completed.size ? 'Continue learning →' : 'Start the learning path →'}</button><button class="chip-btn" data-lesson="challenge-arena">⚔ Challenge Arena</button><button class="chip-btn" data-lesson="cluster-sandbox">🧪 Cluster Sandbox</button></div></div>
      <div class="hero-card"><div class="terminal"><div class="cyan">LEVEL ${progress.current.level}</div><div class="green">${progress.current.name}</div><br><div>${progress.xp} XP earned</div><div>${progress.completed.size}/${readyCount()} labs completed</div><div>${progress.unlocked.length}/${allAchievements().length} achievements unlocked</div><br><div class="amber"># Next recommended</div><div>${recommended ? recommended.title : 'Curriculum complete 🏆'}</div></div></div>
    </section>
    ${progressPanel(progress, recommended)}
    ${cards}
    <div class="footer-note">Progress stays in your browser via localStorage. No account or backend is required.</div>
  `);
  bindGlobalNavigation();
}

async function lessonPage(id) {
  const lesson = findLesson(id);
  if (!lesson || lesson.status !== 'ready' || !lessonLoaders[id]) { location.hash = '#/'; return; }
  const completed = completedLessons();
  const gate = prereqState(id, completed);
  const prereqText = gate.met ? 'Recommended prerequisites met' : `Suggested first: ${gate.missing.map(titleFor).join(', ')}`;

  app.innerHTML = shell(`
    <div class="lesson-header"><div class="breadcrumb"><a href="#/">Learning path</a> / ${lesson.section.title}</div><div class="lesson-meta"><span class="badge">${lesson.level}</span><span class="badge">${lesson.minutes} min</span><span class="badge">+100 XP</span></div><h1>${lesson.title}</h1><p class="hero-copy">${lessonDescription(id)}</p><div class="callout ${gate.met?'success':'warn'}"><strong>${prereqText}</strong><p>${gate.met?'You have the recommended context for this lab.':'Nothing is locked. You can continue here, or open the suggested lessons first.'}</p></div></div>
    <div id="lesson-root"><div class="panel">Loading interactive lab…</div></div>
    <div id="lesson-reward"></div>
  `, id);
  bindGlobalNavigation();

  const module = await lessonLoaders[id]();
  state.currentLesson = module;
  const root = document.querySelector('#lesson-root');
  module.mount(root, {
    markComplete: () => {
      const fresh = markLessonComplete(id);
      const btn = document.querySelector('[data-mark-complete]');
      if (btn) { btn.textContent = fresh ? '✓ Completed · +100 XP' : '✓ Lesson completed'; btn.disabled = true; }
      const progress = progressSnapshot(readyCount());
      const next = recommendedLesson(progress.completed, id);
      const reward = document.querySelector('#lesson-reward');
      if (reward) reward.innerHTML = `<div class="panel" style="margin-top:16px"><div class="eyebrow">${fresh?'XP earned':'Lesson reviewed'}</div><h2>${fresh?'+100 XP · ':''}${progress.current.name}</h2><p class="hero-copy">You now have ${progress.xp} XP and ${progress.completed.size}/${readyCount()} lessons completed.</p>${next?`<button class="primary-btn" data-lesson="${next.id}">Recommended next → ${next.title}</button>`:'<div class="callout success"><strong>Curriculum complete 🏆</strong><p>You have completed every live lesson.</p></div>'}</div>`;
      bindGlobalNavigation();
    },
    awardXP: (key, amount) => awardChallenge(key, amount)
  });
}

function bindGlobalNavigation() {
  document.querySelectorAll('[data-lesson]').forEach(el => {
    if (el.dataset.bound === '1') return;
    el.dataset.bound = '1';
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
