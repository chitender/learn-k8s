export const LEARNING_TRACKS = [
  {
    id: 'beginner',
    icon: '🌱',
    title: 'Beginner Core',
    audience: 'New to Kubernetes',
    description: 'Build the object/controller mental model first, then workloads, networking, storage and debugging.',
    lessons: ['why-kubernetes','cluster-architecture','declarative-model','object-anatomy','labels-selectors','pods','deployments','pod-lifecycle','cpu-scheduling','memory','pod-networking','services','volumes','pv-pvc','kubectl-debug']
  },
  {
    id: 'cka',
    icon: '⚔️',
    title: 'CKA Foundations',
    audience: 'Hands-on administrator path',
    description: 'Emphasizes workload operations, scheduling, networking, storage, security and troubleshooting mechanics.',
    lessons: ['object-anatomy','labels-selectors','pods','deployments','jobs-cronjobs','daemonsets','statefulsets','cpu-scheduling','affinity-taints','priority-preemption','services','dns-ingress','pv-pvc','namespaces-rbac','serviceaccounts-tokens','networkpolicy','pdb-termination','kubectl-debug','events-logs-metrics','challenge-arena']
  },
  {
    id: 'sre',
    icon: '🚨',
    title: 'Production SRE',
    audience: 'Operators and platform engineers',
    description: 'Focuses on failure boundaries, runtime internals, scheduling pressure, observability and multi-subsystem incidents.',
    lessons: ['cpu-scheduling','memory','qos-eviction-ranking','scheduler-framework','cni-deep-dive','service-internals','csi-deep-dive','autoscaling','node-pressure-eviction','admission-control','crds-operators','apiserver-etcd','leases-leader-election','kubelet-internals','cri-runtime','incident-simulator','cluster-sandbox']
  }
];
