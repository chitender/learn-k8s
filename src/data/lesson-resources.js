export const SITE_META = {
  kubernetesBaseline: 'v1.37',
  kubernetesReleaseDate: '2026-08-26',
  validatedAt: '2026-09-10'
};

const k8s = path => `https://kubernetes.io/docs/${path}`;

export const LESSON_RESOURCES = {
  'why-kubernetes': [{ label:'Kubernetes overview', url:k8s('concepts/overview/') }],
  'cluster-architecture': [{ label:'Cluster architecture', url:k8s('concepts/architecture/') }],
  'declarative-model': [{ label:'Kubernetes objects', url:k8s('concepts/overview/working-with-objects/') }],
  'object-anatomy': [{ label:'Objects in Kubernetes', url:k8s('concepts/overview/working-with-objects/') }, { label:'Kubernetes API', url:k8s('concepts/overview/kubernetes-api/') }],
  'labels-selectors': [{ label:'Labels and selectors', url:k8s('concepts/overview/working-with-objects/labels/') }, { label:'Recommended labels', url:k8s('concepts/overview/working-with-objects/common-labels/') }],
  'pods': [{ label:'Pods', url:k8s('concepts/workloads/pods/') }],
  'deployments': [{ label:'Deployments', url:k8s('concepts/workloads/controllers/deployment/') }],
  'pod-lifecycle': [{ label:'Pod lifecycle', url:k8s('concepts/workloads/pods/pod-lifecycle/') }],
  'init-sidecars': [{ label:'Sidecar containers', url:k8s('concepts/workloads/pods/sidecar-containers/') }, { label:'Init containers', url:k8s('concepts/workloads/pods/init-containers/') }],
  'probes-deep-dive': [{ label:'Liveness, readiness and startup probes', url:k8s('concepts/configuration/liveness-readiness-startup-probes/') }],
  'rollout-strategies': [{ label:'Deployment rolling updates', url:k8s('concepts/workloads/controllers/deployment/') }],
  'cpu-scheduling': [{ label:'Resource management', url:k8s('concepts/configuration/manage-resources-containers/') }, { label:'Linux CFS bandwidth control', url:'https://docs.kernel.org/scheduler/sched-bwc.html' }],
  'memory': [{ label:'Resource management', url:k8s('concepts/configuration/manage-resources-containers/') }],
  'affinity-taints': [{ label:'Assign Pods to nodes', url:k8s('concepts/scheduling-eviction/assign-pod-node/') }, { label:'Taints and tolerations', url:k8s('concepts/scheduling-eviction/taint-and-toleration/') }],
  'qos-eviction-ranking': [{ label:'Pod QoS classes', url:k8s('concepts/workloads/pods/pod-qos/') }, { label:'Node-pressure eviction', url:k8s('concepts/scheduling-eviction/node-pressure-eviction/') }],
  'priority-preemption': [{ label:'Pod priority and preemption', url:k8s('concepts/scheduling-eviction/pod-priority-preemption/') }],
  'topology-spread': [{ label:'Topology spread constraints', url:k8s('concepts/scheduling-eviction/topology-spread-constraints/') }],
  'scheduler-framework': [{ label:'Scheduling framework', url:k8s('concepts/scheduling-eviction/scheduling-framework/') }],
  'pod-networking': [{ label:'Services and networking', url:k8s('concepts/services-networking/') }],
  'cni-deep-dive': [{ label:'Network plugins', url:k8s('concepts/extend-kubernetes/compute-storage-net/network-plugins/') }],
  'services': [{ label:'Services', url:k8s('concepts/services-networking/service/') }],
  'service-internals': [{ label:'Services', url:k8s('concepts/services-networking/service/') }, { label:'EndpointSlices', url:k8s('concepts/services-networking/endpoint-slices/') }],
  'dns-ingress': [{ label:'DNS for Services and Pods', url:k8s('concepts/services-networking/dns-pod-service/') }, { label:'Ingress', url:k8s('concepts/services-networking/ingress/') }],
  'volumes': [{ label:'Volumes', url:k8s('concepts/storage/volumes/') }],
  'pv-pvc': [{ label:'Persistent Volumes', url:k8s('concepts/storage/persistent-volumes/') }],
  'csi-deep-dive': [{ label:'Storage volumes / CSI', url:k8s('concepts/storage/volumes/') }],
  'kubectl-debug': [{ label:'Troubleshooting applications', url:k8s('tasks/debug/debug-application/') }],
  'events-logs-metrics': [{ label:'Application troubleshooting', url:k8s('tasks/debug/debug-application/') }, { label:'Resource metrics pipeline', url:k8s('tasks/debug/debug-cluster/resource-metrics-pipeline/') }],
  'autoscaling': [{ label:'Horizontal Pod Autoscaling', url:k8s('concepts/workloads/autoscaling/horizontal-pod-autoscale/') }, { label:'Workload autoscaling', url:k8s('concepts/workloads/autoscaling/') }],
  'node-pressure-eviction': [{ label:'Node-pressure eviction', url:k8s('concepts/scheduling-eviction/node-pressure-eviction/') }],
  'incident-simulator': [{ label:'Troubleshooting', url:k8s('tasks/debug/') }],
  'configmaps-secrets': [{ label:'ConfigMaps', url:k8s('concepts/configuration/configmap/') }, { label:'Secrets', url:k8s('concepts/configuration/secret/') }],
  'namespaces-rbac': [{ label:'Namespaces', url:k8s('concepts/overview/working-with-objects/namespaces/') }, { label:'RBAC', url:k8s('reference/access-authn-authz/rbac/') }],
  'serviceaccounts-tokens': [{ label:'ServiceAccounts', url:k8s('concepts/security/service-accounts/') }],
  'quotas-limits': [{ label:'Resource quotas', url:k8s('concepts/policy/resource-quotas/') }, { label:'LimitRange', url:k8s('concepts/policy/limit-range/') }],
  'jobs-cronjobs': [{ label:'Jobs', url:k8s('concepts/workloads/controllers/job/') }, { label:'CronJobs', url:k8s('concepts/workloads/controllers/cron-jobs/') }],
  'statefulsets': [{ label:'StatefulSets', url:k8s('concepts/workloads/controllers/statefulset/') }],
  'daemonsets': [{ label:'DaemonSets', url:k8s('concepts/workloads/controllers/daemonset/') }],
  'pdb-termination': [{ label:'Pod disruption budgets', url:k8s('tasks/run-application/configure-pdb/') }, { label:'Pod termination', url:k8s('concepts/workloads/pods/pod-lifecycle/') }],
  'networkpolicy': [{ label:'Network Policies', url:k8s('concepts/services-networking/network-policies/') }],
  'pod-security-admission': [{ label:'Pod Security Admission', url:k8s('concepts/security/pod-security-admission/') }],
  'helm': [{ label:'Helm documentation', url:'https://helm.sh/docs/' }],
  'production-capstone': [{ label:'Application management', url:k8s('concepts/workloads/controllers/deployment/') }],
  'admission-control': [{ label:'Admission controllers', url:k8s('reference/access-authn-authz/admission-controllers/') }],
  'crds-operators': [{ label:'Custom resources', url:k8s('concepts/extend-kubernetes/api-extension/custom-resources/') }],
  'apiserver-etcd': [{ label:'Kubernetes API', url:k8s('concepts/overview/kubernetes-api/') }, { label:'etcd', url:k8s('tasks/administer-cluster/configure-upgrade-etcd/') }],
  'leases-leader-election': [{ label:'Leases', url:k8s('concepts/architecture/leases/') }],
  'kubelet-internals': [{ label:'Nodes and kubelet', url:k8s('concepts/architecture/nodes/') }],
  'cri-runtime': [{ label:'Container Runtime Interface', url:k8s('concepts/containers/cri/') }],
  'challenge-arena': [{ label:'Kubernetes documentation', url:'https://kubernetes.io/docs/' }],
  'cluster-sandbox': [{ label:'Kubernetes architecture', url:k8s('concepts/architecture/') }, { label:'Troubleshooting', url:k8s('tasks/debug/') }]
};

export function lessonResources(id) {
  return LESSON_RESOURCES[id] || [];
}
