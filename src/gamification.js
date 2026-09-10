export const XP_PER_LESSON = 100;

export const LEVELS = [
  { level: 1, name: 'Pod Explorer', min: 0 },
  { level: 2, name: 'Controller Wrangler', min: 500 },
  { level: 3, name: 'Cluster Navigator', min: 1200 },
  { level: 4, name: 'Kubernetes Operator', min: 2200 },
  { level: 5, name: 'SRE Investigator', min: 3500 },
  { level: 6, name: 'Control Plane Sage', min: 4700 }
];

const ACHIEVEMENTS = [
  { id: 'first-step', icon: '🌱', title: 'First Pod', detail: 'Complete your first lesson.', test: ({ completed }) => completed.size >= 1 },
  { id: 'foundation', icon: '🧱', title: 'Foundation Built', detail: 'Complete all Foundation lessons.', test: ({ completed }) => ['why-kubernetes','cluster-architecture','declarative-model','object-anatomy','labels-selectors'].every(id => completed.has(id)) },
  { id: 'scheduler', icon: '🧠', title: 'Scheduler Brain', detail: 'Complete CPU, affinity, priority and scheduler framework.', test: ({ completed }) => ['cpu-scheduling','affinity-taints','priority-preemption','scheduler-framework'].every(id => completed.has(id)) },
  { id: 'packet', icon: '🌐', title: 'Packet Whisperer', detail: 'Complete Pod networking, CNI and Service internals.', test: ({ completed }) => ['pod-networking','cni-deep-dive','service-internals'].every(id => completed.has(id)) },
  { id: 'storage', icon: '💾', title: 'Storage Keeper', detail: 'Complete PV/PVC and CSI deep dive.', test: ({ completed }) => ['pv-pvc','csi-deep-dive'].every(id => completed.has(id)) },
  { id: 'incident', icon: '🚨', title: 'Incident Commander', detail: 'Complete troubleshooting and the incident simulator.', test: ({ completed }) => ['kubectl-debug','incident-simulator'].every(id => completed.has(id)) },
  { id: 'halfway', icon: '⚡', title: 'Halfway There', detail: 'Complete at least half the live curriculum.', test: ({ completed, total }) => completed.size >= Math.ceil(total / 2) },
  { id: 'mastery', icon: '🏆', title: 'Cluster Mastery', detail: 'Complete every live lesson.', test: ({ completed, total }) => total > 0 && completed.size >= total }
];

const STORAGE_KEYS = {
  completed: 'learn-k8s-completed',
  solved: 'learn-k8s-challenges-solved',
  challengeXP: 'learn-k8s-challenge-xp',
  collapsedSections: 'learn-k8s-collapsed-sections'
};

function readSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Set(); }
}

function safeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(item => typeof item === 'string' && item.length < 120))];
}

export function completedLessons() {
  return readSet(STORAGE_KEYS.completed);
}

export function solvedChallenges() {
  return readSet(STORAGE_KEYS.solved);
}

export function markLessonComplete(id) {
  const set = completedLessons();
  const isNew = !set.has(id);
  set.add(id);
  localStorage.setItem(STORAGE_KEYS.completed, JSON.stringify([...set]));
  return isNew;
}

export function challengeXP() {
  const value = Number(localStorage.getItem(STORAGE_KEYS.challengeXP) || 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function awardChallenge(id, amount = 25) {
  const solved = solvedChallenges();
  if (solved.has(id)) return { awarded: 0, total: challengeXP() };
  solved.add(id);
  localStorage.setItem(STORAGE_KEYS.solved, JSON.stringify([...solved]));
  const award = Math.max(0, Number(amount) || 0);
  const total = challengeXP() + award;
  localStorage.setItem(STORAGE_KEYS.challengeXP, String(total));
  return { awarded: award, total };
}

export function progressSnapshot(total) {
  const completed = completedLessons();
  const lessonXP = completed.size * XP_PER_LESSON;
  const bonusXP = challengeXP();
  const xp = lessonXP + bonusXP;
  const current = [...LEVELS].reverse().find(item => xp >= item.min) || LEVELS[0];
  const next = LEVELS.find(item => item.min > xp) || null;
  const unlocked = ACHIEVEMENTS.filter(a => a.test({ completed, total }));
  return {
    completed,
    lessonXP,
    bonusXP,
    xp,
    current,
    next,
    unlocked,
    percent: total ? Math.round((completed.size / total) * 100) : 0
  };
}

export function allAchievements() {
  return ACHIEVEMENTS;
}

export function exportProgress() {
  return JSON.stringify({
    schema: 'learn-k8s-progress',
    version: 1,
    exportedAt: new Date().toISOString(),
    completed: [...completedLessons()],
    solvedChallenges: [...solvedChallenges()],
    challengeXP: challengeXP()
  }, null, 2);
}

export function importProgress(raw, validLessonIds = null) {
  let parsed;
  try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { throw new Error('That does not look like valid Learn Kubernetes progress JSON.'); }
  if (!parsed || parsed.schema !== 'learn-k8s-progress' || parsed.version !== 1) {
    throw new Error('Unsupported progress file. Expected learn-k8s-progress version 1.');
  }
  const allowed = validLessonIds ? new Set(validLessonIds) : null;
  const completed = safeStringArray(parsed.completed).filter(id => !allowed || allowed.has(id));
  const solved = safeStringArray(parsed.solvedChallenges);
  const bonus = Math.max(0, Number(parsed.challengeXP) || 0);
  localStorage.setItem(STORAGE_KEYS.completed, JSON.stringify(completed));
  localStorage.setItem(STORAGE_KEYS.solved, JSON.stringify(solved));
  localStorage.setItem(STORAGE_KEYS.challengeXP, String(bonus));
  return { completed: completed.length, solved: solved.length, challengeXP: bonus };
}

export function resetProgress() {
  localStorage.removeItem(STORAGE_KEYS.completed);
  localStorage.removeItem(STORAGE_KEYS.solved);
  localStorage.removeItem(STORAGE_KEYS.challengeXP);
}

export const PREREQUISITES = {
  'cluster-architecture': ['why-kubernetes'],
  'declarative-model': ['cluster-architecture'],
  'object-anatomy': ['declarative-model'],
  'labels-selectors': ['object-anatomy'],
  'pods': ['labels-selectors'],
  'deployments': ['pods'],
  'pod-lifecycle': ['pods'],
  'cpu-scheduling': ['pods'],
  'memory': ['cpu-scheduling'],
  'pod-networking': ['pods'],
  'services': ['pod-networking','labels-selectors'],
  'pv-pvc': ['volumes'],
  'kubectl-debug': ['deployments','pod-lifecycle'],
  'namespaces-rbac': ['cluster-architecture'],
  'serviceaccounts-tokens': ['namespaces-rbac'],
  'statefulsets': ['deployments','pv-pvc'],
  'networkpolicy': ['pod-networking'],
  'production-capstone': ['deployments','services','pv-pvc','cpu-scheduling'],
  'apiserver-etcd': ['cluster-architecture','object-anatomy'],
  'admission-control': ['apiserver-etcd'],
  'crds-operators': ['declarative-model','admission-control'],
  'kubelet-internals': ['cluster-architecture','pods'],
  'cri-runtime': ['kubelet-internals'],
  'cni-deep-dive': ['pod-networking','kubelet-internals'],
  'csi-deep-dive': ['pv-pvc','kubelet-internals'],
  'qos-eviction-ranking': ['cpu-scheduling','memory'],
  'scheduler-framework': ['affinity-taints','priority-preemption'],
  'incident-simulator': ['kubectl-debug','cpu-scheduling','cni-deep-dive','csi-deep-dive'],
  'challenge-arena': ['kubectl-debug','services','cpu-scheduling'],
  'cluster-sandbox': ['deployments','services','cpu-scheduling','pod-networking']
};

export function prereqState(id, completed) {
  const required = PREREQUISITES[id] || [];
  const missing = required.filter(req => !completed.has(req));
  return { required, missing, met: missing.length === 0 };
}
