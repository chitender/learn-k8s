export const curriculum = [
  {
    id: 'foundations',
    title: '01 · Foundations',
    description: 'Build the mental model before touching YAML.',
    lessons: [
      { id: 'why-kubernetes', title: 'Why Kubernetes?', status: 'planned', level: 'Beginner', minutes: 10 },
      { id: 'cluster-architecture', title: 'Cluster architecture', status: 'planned', level: 'Beginner', minutes: 15 },
      { id: 'declarative-model', title: 'Declarative desired state', status: 'planned', level: 'Beginner', minutes: 12 }
    ]
  },
  {
    id: 'workloads',
    title: '02 · Workloads',
    description: 'Pods, controllers, rollouts and lifecycle.',
    lessons: [
      { id: 'pods', title: 'Pods & containers', status: 'planned', level: 'Beginner', minutes: 15 },
      { id: 'deployments', title: 'Deployments & ReplicaSets', status: 'planned', level: 'Beginner', minutes: 20 },
      { id: 'pod-lifecycle', title: 'Pod lifecycle & probes', status: 'planned', level: 'Beginner', minutes: 20 }
    ]
  },
  {
    id: 'scheduling-resources',
    title: '03 · Scheduling & Resources',
    description: 'Understand placement, requests, limits and what Linux actually enforces.',
    lessons: [
      { id: 'cpu-scheduling', title: 'CPU scheduling & throttling', status: 'ready', level: 'Beginner → Intermediate', minutes: 30 },
      { id: 'memory', title: 'Memory requests, limits & OOM', status: 'planned', level: 'Beginner', minutes: 25 },
      { id: 'affinity-taints', title: 'Affinity, taints & tolerations', status: 'planned', level: 'Intermediate', minutes: 25 }
    ]
  },
  {
    id: 'networking',
    title: '04 · Networking',
    description: 'Traffic flow from Pod IP to Service to Ingress.',
    lessons: [
      { id: 'pod-networking', title: 'Pod networking', status: 'planned', level: 'Beginner', minutes: 20 },
      { id: 'services', title: 'Services & kube-proxy', status: 'planned', level: 'Beginner', minutes: 25 },
      { id: 'dns-ingress', title: 'DNS & Ingress', status: 'planned', level: 'Intermediate', minutes: 25 }
    ]
  },
  {
    id: 'storage',
    title: '05 · Storage',
    description: 'Volumes, PVs, PVCs and StorageClasses.',
    lessons: [
      { id: 'volumes', title: 'Volumes & persistence', status: 'planned', level: 'Beginner', minutes: 20 },
      { id: 'pv-pvc', title: 'PV, PVC & StorageClass', status: 'planned', level: 'Beginner', minutes: 25 }
    ]
  },
  {
    id: 'operations',
    title: '06 · Operations',
    description: 'Troubleshooting, observability and safe production habits.',
    lessons: [
      { id: 'kubectl-debug', title: 'kubectl troubleshooting', status: 'planned', level: 'Beginner', minutes: 25 },
      { id: 'events-logs-metrics', title: 'Events, logs & metrics', status: 'planned', level: 'Beginner', minutes: 25 },
      { id: 'autoscaling', title: 'HPA, VPA & Cluster Autoscaler', status: 'planned', level: 'Intermediate', minutes: 30 }
    ]
  }
];

export const lessonLoaders = {
  'cpu-scheduling': () => import('./modules/cpu-scheduling.js')
};

export function findLesson(id) {
  for (const section of curriculum) {
    const lesson = section.lessons.find((item) => item.id === id);
    if (lesson) return { ...lesson, section };
  }
  return null;
}
