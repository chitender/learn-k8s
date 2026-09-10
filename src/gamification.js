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
  { id: 'foundation', icon: '🧱', title: 'Foundation Built', detail: 'Complete all Foundation lessons.', test: ({ completed }) => ['why-kubernetes','cluster-architecture','declarative-model'].every(id => completed.has(id)) },
  { id: 'scheduler', icon: '🧠', title: 'Scheduler Brain', detail: 'Complete CPU, affinity, priority and scheduler framework.', test: ({ completed }) => ['cpu-scheduling','affinity-taints','priority-preemption','scheduler-framework'].every(id => completed.has(id)) },
  { id: 'packet', icon: '🌐', title: 'Packet Whisperer', detail: 'Complete Pod networking, CNI and Service internals.', test: ({ completed }) => ['pod-networking','cni-deep-dive','service-internals'].every(id => completed.has(id)) },
  { id: 'storage', icon: '💾', title: 'Storage Keeper', detail: 'Complete PV/PVC and CSI deep dive.', test: ({ completed }) => ['pv-pvc','csi-deep-dive'].every(id => completed.has(id)) },
  { id: 'incident', icon: '🚨', title: 'Incident Commander', detail: 'Complete troubleshooting and the incident simulator.', test: ({ completed }) => ['kubectl-debug','incident-simulator'].every(id => completed.has(id)) },
  { id: 'halfway', icon: '⚡', title: 'Halfway There', detail: 'Complete at least half the live curriculum.', test: ({ completed, total }) => completed.size >= Math.ceil(total / 2) },
  { id: 'mastery', icon: '🏆', title: 'Cluster Mastery', detail: 'Complete every live lesson.', test: ({ completed, total }) => total > 0 && completed.size >= total }
];

function readSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Set(); }
}

export function completedLessons() {
  return readSet('learn-k8s-completed');
}

export function markLessonComplete(id) {
  const set = completedLessons();
  const isNew = !set.has(id);
  set.add(id);
  localStorage.setItem('learn-k8s-completed', JSON.stringify([...set]));
  return isNew;
}

export function challengeXP() {
  return Number(localStorage.getItem('learn-k8s-challenge-xp') || 0);
}

export function awardChallenge(id, amount = 25) {
  const solved = readSet('learn-k8s-challenges-solved');
  if (solved.has(id)) return { awarded: 0, total: challengeXP() };
  solved.add(id);
  localStorage.setItem('learn-k8s-challenges-solved', JSON.stringify([...solved]));
  const total = challengeXP() + Math.max(0, Number(amount) || 0);
  localStorage.setItem('learn-k8s-challenge-xp', String(total));
  return { awarded: amount, total };
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

export const PREREQUISITES = {
  'cluster-architecture': ['why-kubernetes'],
  'declarative-model': ['cluster-architecture'],
  'pods': ['declarative-model'],
  'deployments': ['pods'],
  'pod-lifecycle': ['pods'],
  'cpu-scheduling': ['pods'],
  'memory': ['cpu-scheduling'],
  'pod-networking': ['pods'],
  'services': ['pod-networking'],
  'pv-pvc': ['volumes'],
  'kubectl-debug': ['deployments','pod-lifecycle'],
  'namespaces-rbac': ['cluster-architecture'],
  'serviceaccounts-tokens': ['namespaces-rbac'],
  'statefulsets': ['deployments','pv-pvc'],
  'networkpolicy': ['pod-networking'],
  'production-capstone': ['deployments','services','pv-pvc','cpu-scheduling'],
  'apiserver-etcd': ['cluster-architecture'],
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
