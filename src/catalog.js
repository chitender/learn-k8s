export const curriculum = [
  {
    id: 'foundations', title: '01 · Foundations', description: 'Build the mental model before touching YAML.',
    lessons: [
      { id: 'why-kubernetes', title: 'Why Kubernetes?', status: 'ready', level: 'Beginner', minutes: 10 },
      { id: 'cluster-architecture', title: 'Cluster architecture', status: 'ready', level: 'Beginner', minutes: 15 },
      { id: 'declarative-model', title: 'Declarative desired state', status: 'ready', level: 'Beginner', minutes: 12 }
    ]
  },
  {
    id: 'workloads', title: '02 · Workloads', description: 'Pods, controllers, container lifecycle, health and rollout behavior.',
    lessons: [
      { id: 'pods', title: 'Pods & containers', status: 'ready', level: 'Beginner', minutes: 15 },
      { id: 'deployments', title: 'Deployments & ReplicaSets', status: 'ready', level: 'Beginner', minutes: 20 },
      { id: 'pod-lifecycle', title: 'Pod lifecycle & probes', status: 'ready', level: 'Beginner', minutes: 20 },
      { id: 'init-sidecars', title: 'Init containers & native sidecars', status: 'ready', level: 'Intermediate', minutes: 22 },
      { id: 'probes-deep-dive', title: 'Probes deep dive', status: 'ready', level: 'Intermediate', minutes: 24 },
      { id: 'rollout-strategies', title: 'Rolling updates deep dive', status: 'ready', level: 'Intermediate', minutes: 25 }
    ]
  },
  {
    id: 'scheduling-resources', title: '03 · Scheduling & Resources', description: 'Understand placement, requests, limits, QoS and the scheduler pipeline behind placement decisions.',
    lessons: [
      { id: 'cpu-scheduling', title: 'CPU scheduling & throttling', status: 'ready', level: 'Beginner → Intermediate', minutes: 30 },
      { id: 'memory', title: 'Memory requests, limits & OOM', status: 'ready', level: 'Beginner', minutes: 25 },
      { id: 'affinity-taints', title: 'Affinity, taints & tolerations', status: 'ready', level: 'Intermediate', minutes: 25 },
      { id: 'qos-eviction-ranking', title: 'QoS classes & eviction ranking', status: 'ready', level: 'Intermediate', minutes: 25 },
      { id: 'priority-preemption', title: 'Priority & preemption', status: 'ready', level: 'Intermediate', minutes: 22 },
      { id: 'topology-spread', title: 'Topology spread constraints', status: 'ready', level: 'Intermediate', minutes: 22 },
      { id: 'scheduler-framework', title: 'Scheduler framework', status: 'ready', level: 'Intermediate → Advanced', minutes: 28 }
    ]
  },
  {
    id: 'networking', title: '04 · Networking', description: 'Traffic flow from Pod network plumbing to Service, EndpointSlice and Ingress.',
    lessons: [
      { id: 'pod-networking', title: 'Pod networking', status: 'ready', level: 'Beginner', minutes: 20 },
      { id: 'cni-deep-dive', title: 'CNI deep dive', status: 'ready', level: 'Intermediate → Advanced', minutes: 28 },
      { id: 'services', title: 'Services & kube-proxy', status: 'ready', level: 'Beginner', minutes: 25 },
      { id: 'service-internals', title: 'Service internals & EndpointSlices', status: 'ready', level: 'Intermediate', minutes: 25 },
      { id: 'dns-ingress', title: 'DNS & Ingress', status: 'ready', level: 'Intermediate', minutes: 25 }
    ]
  },
  {
    id: 'storage', title: '05 · Storage', description: 'Volumes, PVs, PVCs, StorageClasses and CSI node/controller paths.',
    lessons: [
      { id: 'volumes', title: 'Volumes & persistence', status: 'ready', level: 'Beginner', minutes: 20 },
      { id: 'pv-pvc', title: 'PV, PVC & StorageClass', status: 'ready', level: 'Beginner', minutes: 25 },
      { id: 'csi-deep-dive', title: 'CSI deep dive', status: 'ready', level: 'Intermediate → Advanced', minutes: 28 }
    ]
  },
  {
    id: 'operations', title: '06 · Operations', description: 'Troubleshooting, observability, autoscaling, node survival and incident diagnosis.',
    lessons: [
      { id: 'kubectl-debug', title: 'kubectl troubleshooting', status: 'ready', level: 'Beginner', minutes: 25 },
      { id: 'events-logs-metrics', title: 'Events, logs & metrics', status: 'ready', level: 'Beginner', minutes: 25 },
      { id: 'autoscaling', title: 'HPA, VPA & Cluster Autoscaler', status: 'ready', level: 'Intermediate', minutes: 30 },
      { id: 'node-pressure-eviction', title: 'Node pressure & eviction', status: 'ready', level: 'Intermediate', minutes: 24 },
      { id: 'incident-simulator', title: 'Production incident simulator', status: 'ready', level: 'Intermediate → Advanced', minutes: 35 }
    ]
  },
  {
    id: 'configuration-access', title: '07 · Configuration & Access', description: 'Inject configuration safely, isolate teams, and control workload/API identity.',
    lessons: [
      { id: 'configmaps-secrets', title: 'ConfigMaps & Secrets', status: 'ready', level: 'Beginner', minutes: 20 },
      { id: 'namespaces-rbac', title: 'Namespaces & RBAC', status: 'ready', level: 'Beginner → Intermediate', minutes: 25 },
      { id: 'serviceaccounts-tokens', title: 'ServiceAccounts & tokens', status: 'ready', level: 'Intermediate', minutes: 22 },
      { id: 'quotas-limits', title: 'ResourceQuota & LimitRange', status: 'ready', level: 'Intermediate', minutes: 20 }
    ]
  },
  {
    id: 'workload-patterns', title: '08 · Workload Patterns', description: 'Choose the right controller for finite work, stateful systems, and node-local agents.',
    lessons: [
      { id: 'jobs-cronjobs', title: 'Jobs & CronJobs', status: 'ready', level: 'Beginner', minutes: 20 },
      { id: 'statefulsets', title: 'StatefulSets', status: 'ready', level: 'Intermediate', minutes: 25 },
      { id: 'daemonsets', title: 'DaemonSets', status: 'ready', level: 'Beginner → Intermediate', minutes: 20 }
    ]
  },
  {
    id: 'reliability-security', title: '09 · Reliability & Security', description: 'Protect availability during change and apply workload/network security guardrails.',
    lessons: [
      { id: 'pdb-termination', title: 'PDBs & graceful termination', status: 'ready', level: 'Intermediate', minutes: 25 },
      { id: 'networkpolicy', title: 'NetworkPolicy', status: 'ready', level: 'Intermediate', minutes: 25 },
      { id: 'pod-security-admission', title: 'Pod Security Admission', status: 'ready', level: 'Intermediate', minutes: 24 }
    ]
  },
  {
    id: 'packaging-capstone', title: '10 · Packaging & Capstone', description: 'Understand packaging, then assemble the fundamentals into a production-style workload.',
    lessons: [
      { id: 'helm', title: 'Helm chart mental model', status: 'ready', level: 'Beginner → Intermediate', minutes: 20 },
      { id: 'production-capstone', title: 'Production app capstone', status: 'ready', level: 'Intermediate', minutes: 35 }
    ]
  },
  {
    id: 'api-machinery', title: '11 · API Machinery & Extensibility', description: 'Understand how API requests are admitted and how Kubernetes can be extended without changing core Kubernetes.',
    lessons: [
      { id: 'admission-control', title: 'Admission control & webhooks', status: 'ready', level: 'Intermediate → Advanced', minutes: 28 },
      { id: 'crds-operators', title: 'CRDs & operator pattern', status: 'ready', level: 'Intermediate → Advanced', minutes: 30 }
    ]
  },
  {
    id: 'control-plane-node-internals', title: '12 · Control Plane & Node Internals', description: 'Trace cluster state from API persistence to node reconciliation and container runtime execution.',
    lessons: [
      { id: 'apiserver-etcd', title: 'API server & etcd request lifecycle', status: 'ready', level: 'Intermediate → Advanced', minutes: 30 },
      { id: 'leases-leader-election', title: 'Leases & leader election', status: 'ready', level: 'Intermediate', minutes: 24 },
      { id: 'kubelet-internals', title: 'kubelet internals', status: 'ready', level: 'Intermediate → Advanced', minutes: 30 },
      { id: 'cri-runtime', title: 'CRI & container runtime', status: 'ready', level: 'Intermediate → Advanced', minutes: 26 }
    ]
  },
  {
    id: 'practice-mastery', title: '13 · Practice & Mastery', description: 'Combine concepts under pressure, earn bonus XP, and practice diagnosing the whole cluster.',
    lessons: [
      { id: 'challenge-arena', title: 'CKA / SRE challenge arena', status: 'ready', level: 'Beginner → Advanced', minutes: 30 },
      { id: 'cluster-sandbox', title: 'Whole-cluster sandbox', status: 'ready', level: 'Intermediate → Advanced', minutes: 35 }
    ]
  }
];

export const lessonLoaders = {
  'why-kubernetes': () => import('./modules/why-kubernetes.js'),
  'cluster-architecture': () => import('./modules/cluster-architecture.js'),
  'declarative-model': () => import('./modules/declarative-model.js'),
  'pods': () => import('./modules/pods.js'),
  'deployments': () => import('./modules/deployments.js'),
  'pod-lifecycle': () => import('./modules/pod-lifecycle.js'),
  'init-sidecars': () => import('./modules/init-sidecars.js'),
  'probes-deep-dive': () => import('./modules/probes-deep-dive.js'),
  'rollout-strategies': () => import('./modules/rollout-strategies.js'),
  'cpu-scheduling': () => import('./modules/cpu-scheduling.js'),
  'memory': () => import('./modules/memory.js'),
  'affinity-taints': () => import('./modules/affinity-taints.js'),
  'qos-eviction-ranking': () => import('./modules/qos-eviction-ranking.js'),
  'priority-preemption': () => import('./modules/priority-preemption.js'),
  'topology-spread': () => import('./modules/topology-spread.js'),
  'scheduler-framework': () => import('./modules/scheduler-framework.js'),
  'pod-networking': () => import('./modules/pod-networking.js'),
  'cni-deep-dive': () => import('./modules/cni-deep-dive.js'),
  'services': () => import('./modules/services.js'),
  'service-internals': () => import('./modules/service-internals.js'),
  'dns-ingress': () => import('./modules/dns-ingress.js'),
  'volumes': () => import('./modules/volumes.js'),
  'pv-pvc': () => import('./modules/pv-pvc.js'),
  'csi-deep-dive': () => import('./modules/csi-deep-dive.js'),
  'kubectl-debug': () => import('./modules/kubectl-debug.js'),
  'events-logs-metrics': () => import('./modules/events-logs-metrics.js'),
  'autoscaling': () => import('./modules/autoscaling.js'),
  'node-pressure-eviction': () => import('./modules/node-pressure-eviction.js'),
  'incident-simulator': () => import('./modules/incident-simulator.js'),
  'configmaps-secrets': () => import('./modules/configmaps-secrets.js'),
  'namespaces-rbac': () => import('./modules/namespaces-rbac.js'),
  'serviceaccounts-tokens': () => import('./modules/serviceaccounts-tokens.js'),
  'quotas-limits': () => import('./modules/quotas-limits.js'),
  'jobs-cronjobs': () => import('./modules/jobs-cronjobs.js'),
  'statefulsets': () => import('./modules/statefulsets.js'),
  'daemonsets': () => import('./modules/daemonsets.js'),
  'pdb-termination': () => import('./modules/pdb-termination.js'),
  'networkpolicy': () => import('./modules/networkpolicy.js'),
  'pod-security-admission': () => import('./modules/pod-security-admission.js'),
  'helm': () => import('./modules/helm.js'),
  'production-capstone': () => import('./modules/production-capstone.js'),
  'admission-control': () => import('./modules/admission-control.js'),
  'crds-operators': () => import('./modules/crds-operators.js'),
  'apiserver-etcd': () => import('./modules/apiserver-etcd.js'),
  'leases-leader-election': () => import('./modules/leases-leader-election.js'),
  'kubelet-internals': () => import('./modules/kubelet-internals.js'),
  'cri-runtime': () => import('./modules/cri-runtime.js'),
  'challenge-arena': () => import('./modules/challenge-arena.js'),
  'cluster-sandbox': () => import('./modules/cluster-sandbox.js')
};

export function findLesson(id) {
  for (const section of curriculum) {
    const lesson = section.lessons.find((item) => item.id === id);
    if (lesson) return { ...lesson, section };
  }
  return null;
}
