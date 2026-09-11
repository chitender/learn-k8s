export const PRODUCTION_INCIDENTS = [
  {
    id: 'cpu-throttling-low-average',
    lessons: ['cpu-scheduling', 'autoscaling'],
    title: 'Latency jumped after CPU limits, even though average CPU looked low',
    sourceType: 'Stack Overflow case',
    sourceLabel: 'Pod CPU Throttling',
    sourceUrl: 'https://stackoverflow.com/questions/54099425/pod-cpu-throttling',
    confidence: 'Community case · mechanism corroborated by Kubernetes and Linux cgroup behavior',
    summary: 'A team added CPU requests and limits based on observed usage. Response times increased sharply even though dashboards showed usage below the configured limit. Raising the limit reduced throttling.',
    symptoms: [
      'Application latency increased immediately after resource limits were introduced.',
      'Average CPU graphs remained comfortably below the configured limit.',
      'CPU throttling counters increased, and a higher CPU limit reduced the problem.'
    ],
    evidence: [
      'The regression correlated with enabling CPU bandwidth limits, not a code deployment.',
      'Short bursts can consume a cgroup CPU quota inside a bandwidth period even when long-window average CPU looks low.',
      'The correct low-level evidence is cgroup throttling data such as nr_throttled / throttled_usec, not only averaged CPU utilization.'
    ],
    rootCause: 'The workload was bursty enough to exhaust its cgroup CPU bandwidth quota during short intervals. The hard CPU limit throttled runnable work even when node-level CPU still appeared available.',
    takeaway: 'Separate scheduler accounting from runtime enforcement. Requests influence placement and relative entitlement; CPU limits create a hard cgroup bandwidth ceiling. For latency-sensitive services, inspect throttling counters before assuming low average CPU means CPU cannot be the bottleneck.',
    challenge: {
      prompt: 'Node CPU is 35%, application p99 latency rises, and the container\'s throttled-period counter climbs quickly. Which observation best explains the incident?',
      choices: [
        'The scheduler is refusing to run the already-scheduled Pod because the node is only 35% busy.',
        'A CPU limit can exhaust the container cgroup quota during bursts and throttle it before node CPU is saturated.',
        'The HPA must always scale down whenever node CPU is below 50%.',
        'CPU requests are hard runtime caps, so the request value is directly stopping the process.'
      ],
      answer: 1,
      explanation: 'CPU limits are enforced as cgroup bandwidth caps. A burst can exhaust the quota inside a short period while averaged node or container CPU remains deceptively low.'
    }
  },
  {
    id: 'preply-dns-conntrack',
    lessons: ['service-internals', 'dns-ingress', 'pod-networking'],
    title: 'Healthy Service objects, broken DNS traffic: stale conntrack state',
    sourceType: 'Public postmortem',
    sourceLabel: 'Preply Engineering — DNS issues in Kubernetes',
    sourceUrl: 'https://medium.com/preply-engineering/dns-issues-in-kubernete-spublic-postmortem-1-e169efd45afd',
    confidence: 'First-party public postmortem',
    summary: 'Preply documented a partial production DNS outage in which UDP DNS traffic continued to be routed through stale connection-tracking state after a kube-dns endpoint changed. The incident dropped application events even though the Kubernetes objects themselves did not obviously explain the failure.',
    symptoms: [
      'Only some services experienced DNS failures.',
      'The kube-dns Service and replacement endpoints existed.',
      'Traffic could still follow stale node-level connection tracking toward an endpoint that no longer existed.'
    ],
    evidence: [
      'The failure lived below the Service API object, in node networking state.',
      'UDP plus conntrack made the failure intermittent and difficult to infer from application logs alone.',
      'Inspecting node dataplane/conntrack state was more useful than repeatedly recreating Service objects.'
    ],
    rootCause: 'Stale conntrack state was not successfully cleared when a DNS endpoint changed, so some DNS traffic continued toward a nonexistent backend.',
    takeaway: 'A correct Service selector and a healthy EndpointSlice do not prove the node dataplane is forwarding new packets correctly. When object state looks right, move one layer down: kube-proxy/eBPF rules, conntrack, routes, packet capture, and node-local network state.',
    challenge: {
      prompt: 'The kube-dns Service and Ready endpoints look correct, but only some nodes still send DNS packets toward an old Pod IP. Which layer should you investigate next?',
      choices: [
        'Deployment replica reconciliation only',
        'Node dataplane state such as conntrack and Service forwarding rules',
        'The PVC binding controller',
        'The HPA target utilization percentage'
      ],
      answer: 1,
      explanation: 'When API objects and endpoint membership are correct but packets still follow stale destinations, the failure boundary has moved into node-level forwarding or connection-tracking state.'
    }
  },
  {
    id: 'render-control-plane-dns-coupling',
    lessons: ['apiserver-etcd', 'cluster-architecture', 'dns-ingress'],
    title: 'Control-plane overload became a data-plane outage through DNS coupling',
    sourceType: 'Public engineering incident',
    sourceLabel: 'Render — hidden DNS dependency in Kubernetes',
    sourceUrl: 'https://render.com/blog/a-hidden-dns-dependency-in-kubernetes',
    confidence: 'First-party Render incident analysis with their own production failure described',
    summary: 'Render described a production incident in which an etcd memory spike overloaded a control plane. The situation became far worse when DNS servers running on control-plane nodes restarted and could not initialize while the API server was unavailable.',
    symptoms: [
      'At first, control-plane operations such as new deploys and jobs failed.',
      'Already-running data-plane workloads were initially less affected.',
      'After control-plane node/DNS restarts, name resolution failed and running services began failing too.'
    ],
    evidence: [
      'CoreDNS can continue answering from its in-memory Kubernetes state while already running, but initialization depends on reaching the Kubernetes API.',
      'Co-locating a data-plane dependency such as DNS with a degraded control plane widened the blast radius.',
      'Render later isolated CoreDNS onto data-plane nodes and etcd onto dedicated nodes.'
    ],
    rootCause: 'A control-plane resource incident crossed into the data plane because DNS availability was coupled to the same control-plane failure domain.',
    takeaway: 'Design for failure-domain independence. A control-plane outage should degrade scheduling and reconciliation without unnecessarily taking down already-running request paths. Identify hidden dependencies that make the data plane require control-plane recovery.',
    challenge: {
      prompt: 'The API server is unavailable, but existing application Pods are still running. Why can restarting CoreDNS at this moment make the user-facing outage much worse?',
      choices: [
        'CoreDNS needs the scheduler to route every individual DNS packet.',
        'A restarting CoreDNS instance needs Kubernetes API state to initialize, so it may not recover while the control plane is unavailable.',
        'Every DNS query is persisted to etcd before a response is sent.',
        'Services lose their ClusterIP immediately whenever etcd is slow.'
      ],
      answer: 1,
      explanation: 'Running DNS instances may retain useful state, but a restarted DNS instance needs to initialize its Kubernetes view. If that dependency is unavailable, a control-plane incident can remove DNS from an otherwise still-running data plane.'
    }
  },
  {
    id: 'pdb-blocked-drain',
    lessons: ['pdb-termination', 'node-pressure-eviction'],
    title: 'A routine node drain would not finish because the PDB was doing its job',
    sourceType: 'Stack Overflow case',
    sourceLabel: 'GKE Pod migration blocked by PDB',
    sourceUrl: 'https://stackoverflow.com/questions/76678138/gke-pod-migration-to-2nd-nodepool-blocked-by-pdb-and-2nd-nodepool-not-scaling-up',
    confidence: 'Community troubleshooting case · behavior matches Kubernetes disruption semantics',
    summary: 'During a GKE node-pool migration, kubectl drain repeatedly refused to evict a workload because doing so would violate its PodDisruptionBudget. The operator initially experienced this as a stuck migration rather than an availability guardrail.',
    symptoms: [
      'The node was cordoned and drain repeatedly retried.',
      'kubectl reported that eviction would violate the PodDisruptionBudget.',
      'The expected replacement capacity/Ready replica was not available soon enough to make the eviction safe.'
    ],
    evidence: [
      'Drain uses the Eviction API and respects PDBs.',
      'A PDB does not create replacement capacity or make another Pod Ready by itself.',
      'The safe fix is to restore enough schedulable/Ready capacity or deliberately change the disruption policy, not blindly bypass it.'
    ],
    rootCause: 'The planned voluntary disruption would have reduced available replicas below the PDB requirement, so Kubernetes correctly blocked the eviction.',
    takeaway: 'A blocked drain is often evidence of a missing capacity or readiness assumption, not a broken PDB. Before maintenance, verify replica count, PDB allowance, startup time, scheduler constraints, and destination-node capacity together.',
    challenge: {
      prompt: 'kubectl drain says “Cannot evict pod as it would violate the pod\'s disruption budget.” What is the safest first interpretation?',
      choices: [
        'The scheduler is corrupted and the PDB should always be deleted.',
        'The voluntary eviction would currently break the declared availability budget; restore capacity/readiness or intentionally revise the budget.',
        'The kubelet is performing node-pressure eviction, which always honors PDBs.',
        'The Service selector is preventing kubectl from deleting the Pod.'
      ],
      answer: 1,
      explanation: 'Drain is an eviction-aware voluntary disruption. If the PDB blocks it, first determine why the required number of Ready replicas cannot be maintained.'
    }
  },
  {
    id: 'oomkill-versus-node-pressure',
    lessons: ['memory', 'qos-eviction-ranking'],
    title: 'Same symptom family, two different memory failures: OOMKilled vs eviction',
    sourceType: 'Stack Overflow case',
    sourceLabel: 'Pods evicted due to memory or OOMKilled',
    sourceUrl: 'https://stackoverflow.com/questions/61675985/pods-evicted-due-to-memory-or-oomkilled',
    confidence: 'Community Q&A case · distinction matches Kubernetes memory semantics',
    summary: 'An operator saw workloads disappear under memory pressure and treated eviction and OOMKilled as if they meant the same thing. The case demonstrates why container-limit exhaustion and node-level memory pressure require different evidence and different fixes.',
    symptoms: [
      'Some Pods were evicted when the node itself was short on memory.',
      'Other containers were OOMKilled after hitting their own configured memory limit.',
      'Increasing only one number without identifying which boundary failed could hide, not solve, the problem.'
    ],
    evidence: [
      'Container OOMKilled points toward the container/cgroup memory ceiling or process memory behavior.',
      'Pod eviction under MemoryPressure is a kubelet/node resource decision and is influenced by requests, priority, and actual usage.',
      'Events, terminated container state, node conditions, and memory working-set trends separate the two paths.'
    ],
    rootCause: 'Two distinct enforcement layers were being conflated: a container exceeded its memory limit in one path, while node-wide memory pressure caused kubelet eviction in another.',
    takeaway: 'Never stop at the word “memory.” Ask which boundary acted: kernel/container OOM, kubelet node-pressure eviction, application-level OOM, or scheduling failure due to memory requests.',
    challenge: {
      prompt: 'A container lastState says OOMKilled, while the node has no MemoryPressure condition. Which boundary is the strongest first suspect?',
      choices: [
        'The container memory limit / process memory behavior',
        'PodDisruptionBudget voluntary eviction',
        'CoreDNS cache expiration',
        'Scheduler CPU scoring'
      ],
      answer: 0,
      explanation: 'OOMKilled in the container terminated state directly points toward memory exhaustion inside that container boundary. Node-pressure eviction has a different evidence trail.'
    }
  },
  {
    id: 'service-selector-no-endpoints',
    lessons: ['labels-selectors', 'services'],
    title: 'The Service existed, but its selector matched zero Pods',
    sourceType: 'Stack Overflow case',
    sourceLabel: 'Why is the Service endpoints list empty?',
    sourceUrl: 'https://stackoverflow.com/questions/71469387/k8s-why-the-service-endpoints-is-none-i-e-empty',
    confidence: 'Community troubleshooting case · direct reproducible configuration error',
    summary: 'A Service returned no useful backend traffic because its selector used a label key/value that the target Pods did not actually have. Correcting the selector immediately restored endpoint membership.',
    symptoms: [
      'Service object existed and had a ClusterIP.',
      'Endpoint membership was empty.',
      'Pod labels and Service selector looked similar at a glance but did not match exactly.'
    ],
    evidence: [
      'A Service selects Pods using its spec.selector, not the Service object\'s own metadata.labels.',
      'Every selector requirement must match for a Pod to be selected.',
      'kubectl get pods --show-labels plus kubectl describe service quickly exposes the mismatch.'
    ],
    rootCause: 'The Service selector did not match the labels on the intended Pods, so the endpoint controller had no backends to publish.',
    takeaway: 'For “Service exists but traffic fails,” inspect EndpointSlices early. Zero endpoints narrows the search dramatically: selector mismatch, readiness, or intentionally selectorless Service behavior.',
    challenge: {
      prompt: 'A ClusterIP Service resolves in DNS, but its EndpointSlice has zero endpoints. All application Pods are Running and Ready. What should you compare first?',
      choices: [
        'Service spec.selector against Pod metadata.labels',
        'Container CPU limit against node allocatable CPU',
        'PVC reclaimPolicy against StorageClass',
        'etcd compaction revision against kubelet version'
      ],
      answer: 0,
      explanation: 'With Ready Pods but no selected endpoints, a selector/label mismatch is one of the highest-signal checks.'
    }
  },
  {
    id: 'hpa-request-denominator',
    lessons: ['autoscaling', 'cpu-scheduling'],
    title: 'HPA scaled “too early” because the CPU request changed the denominator',
    sourceType: 'Stack Overflow case',
    sourceLabel: 'HPA scaling even though current CPU is below target',
    sourceUrl: 'https://stackoverflow.com/questions/66699296/hpa-scaling-even-though-current-cpu-is-below-target-cpu',
    confidence: 'Community Q&A case · HPA formula matches Kubernetes behavior',
    summary: 'An HPA appeared to scale unexpectedly because the operator compared raw CPU usage with the target percentage instead of remembering that CPU utilization is calculated relative to each Pod\'s CPU request.',
    symptoms: [
      'Dashboard CPU numbers looked lower than the engineer expected for a scale-up.',
      'The HPA target was a percentage, not an absolute millicore threshold.',
      'Changing CPU requests changed the meaning of the same observed CPU usage.'
    ],
    evidence: [
      'For resource utilization targets, utilization is based on observed usage divided by requested CPU.',
      'The same 400m usage is 80% of a 500m request but 40% of a 1000m request.',
      'Resource requests therefore affect both scheduler placement and CPU-utilization HPA math.'
    ],
    rootCause: 'The mental model treated HPA utilization as a percentage of CPU limit or node capacity instead of a percentage of the Pod CPU request.',
    takeaway: 'Resource requests are not only scheduler inputs. When HPA uses CPU utilization, requests define the denominator. Rightsizing requests changes scaling behavior and cluster packing simultaneously.',
    challenge: {
      prompt: 'A Pod uses 400m CPU. Its request is 500m, and the HPA CPU target is 70%. What utilization does HPA see for this simplified case?',
      choices: ['40%', '50%', '70%', '80%'],
      answer: 3,
      explanation: '400m / 500m × 100 = 80%. The HPA resource-utilization target is based on the request, not the CPU limit or whole-node capacity.'
    }
  },
  {
    id: 'registry-outage-imagepullbackoff',
    lessons: ['kubectl-debug', 'cri-runtime', 'deployments'],
    title: 'A registry outage turned an ordinary Pod restart into ImagePullBackOff',
    sourceType: 'Reddit community report',
    sourceLabel: 'A 4 AM lesson in registry coupling',
    sourceUrl: 'https://www.reddit.com/r/kubernetes/comments/1tlpnsx/a_4_am_lesson_in_registry_coupling/',
    confidence: 'Community-reported production scenario · use as an operational pattern, not a canonical postmortem',
    summary: 'A team reported a remote registry outage coinciding with a Pod restart. Because the workload required a fresh pull, the replacement could not start and entered ImagePullBackOff until registry access recovered.',
    symptoms: [
      'The application image had run successfully before the incident.',
      'A Pod restart or new node forced an image pull.',
      'The registry was unavailable, so the replacement Pod could not progress to container start.'
    ],
    evidence: [
      'ImagePullBackOff happens before application startup; application logs may not exist yet.',
      'Events from kubelet/container runtime show pull/auth/registry errors.',
      'Registry availability, image caching, pull-through mirrors, pull policy, and deployment strategy all influence blast radius.'
    ],
    rootCause: 'The workload\'s restart path had a synchronous dependency on an unavailable image registry, so Kubernetes could create the Pod object but could not obtain the image needed to start the container.',
    takeaway: 'Treat image distribution as part of runtime reliability. During ImagePullBackOff, start with Events and runtime/registry reachability instead of debugging the application process that has not started yet.',
    challenge: {
      prompt: 'A previously healthy Deployment restarts one replica during a registry outage. The new Pod is ImagePullBackOff and has no application logs. Where should you investigate first?',
      choices: [
        'Container registry reachability/authentication and kubelet image-pull events',
        'Application request latency inside the new container',
        'HPA scale-down stabilization',
        'ServiceAccount RBAC for listing Deployments'
      ],
      answer: 0,
      explanation: 'The container has not started yet. Image pull events and registry/runtime dependencies are the correct failure boundary.'
    }
  },
  {
    id: 'csi-bound-but-failedmount',
    lessons: ['csi-deep-dive', 'pv-pvc', 'kubelet-internals'],
    title: 'PVC Bound and volume attached — but the Pod still could not mount it',
    sourceType: 'Reddit community case',
    sourceLabel: 'CephFS FailedMount after successful PVC binding/attach',
    sourceUrl: 'https://www.reddit.com/r/kubernetes/comments/1nuj0jc/',
    confidence: 'Community troubleshooting case · useful boundary evidence, final root cause not fully proven',
    summary: 'A CephFS workload had a Bound PVC and successful attach event, yet kubelet repeatedly reported FailedMount from the CSI node path. The case is valuable because it demonstrates exactly what earlier storage success does—and does not—prove.',
    symptoms: [
      'PVC status was Bound.',
      'AttachVolume reported success.',
      'MountVolume.MountDevice / CSI node-side operations still failed.'
    ],
    evidence: [
      'PVC binding proves the control-plane claim/PV relationship, not node filesystem readiness.',
      'Successful attach still does not prove NodeStage/NodePublish or host mount prerequisites will work.',
      'The kubelet event identifies the node-side storage boundary that should be investigated next.'
    ],
    rootCause: 'The documented case reached the CSI/node mount stage and failed there; the exact Ceph-side cause was not conclusively established in the public thread. That uncertainty is itself part of the lesson.',
    takeaway: 'Do not turn “PVC Bound” into “storage is fine.” Trace the storage state machine: provision/bind → attach (if required) → stage → publish/mount → application filesystem access.',
    challenge: {
      prompt: 'PVC=Bound and AttachVolume=succeeded, but kubelet reports NodePublishVolume/FailedMount. Which statement is most accurate?',
      choices: [
        'The scheduler cannot see the PVC, so the Pod has never been assigned.',
        'Binding and attach succeeded, but node-side CSI staging/publish/mount can still fail independently.',
        'The Service selector must be wrong.',
        'A Bound PVC guarantees the filesystem is mounted inside the container.'
      ],
      answer: 1,
      explanation: 'Kubernetes storage has multiple independent stages. A successful earlier stage does not guarantee node-side mount success.'
    }
  },
  {
    id: 'probe-failures-shared-dns',
    lessons: ['probes-deep-dive', 'pod-lifecycle', 'dns-ingress'],
    title: 'Probe timeouts looked like an application-health problem, but DNS was the shared failure',
    sourceType: 'Stack Overflow case',
    sourceLabel: 'Liveness/readiness context deadline exceeded',
    sourceUrl: 'https://stackoverflow.com/questions/76749094/liveness-and-readiness-probe-failed-context-deadline-exceeded-client-timeout-e',
    confidence: 'Community troubleshooting case with a documented resolution',
    summary: 'A troubleshooting case showed readiness/liveness failures and CrashLoopBackOff symptoms across workloads. The eventual fix was in cluster DNS, demonstrating how probes can expose a shared dependency failure rather than an application-local defect.',
    symptoms: [
      'Health checks timed out rather than returning an application-specific unhealthy response.',
      'More than one workload showed similar failures.',
      'Correcting CoreDNS/upstream DNS behavior cleared the probe failures.'
    ],
    evidence: [
      'A probe failure tells you the health check could not succeed; it does not automatically identify the underlying subsystem.',
      'Correlated failures across unrelated workloads are a strong reason to check shared dependencies.',
      'DNS, node networking, Service routing, and overloaded dependencies can all make a valid probe endpoint time out.'
    ],
    rootCause: 'A shared DNS resolution problem caused application dependencies and health checks to fail, which then surfaced as readiness/liveness symptoms and restarts.',
    takeaway: 'Probes are actuators as well as observability signals. Before making liveness more aggressive, ask whether the failure is local to the process or caused by a shared dependency that restarting the process cannot fix.',
    challenge: {
      prompt: 'Several unrelated workloads begin failing health checks with network timeouts at the same time. What is the best first diagnostic move?',
      choices: [
        'Lower every liveness failureThreshold immediately.',
        'Look for a shared dependency failure such as DNS, node networking, or a common upstream before treating each application separately.',
        'Delete every Pod so all probes restart from zero.',
        'Increase Deployment maxSurge because probe timeouts are scheduler failures.'
      ],
      answer: 1,
      explanation: 'Correlated timeout-style probe failures across unrelated workloads point toward a shared dependency or infrastructure boundary before an app-local bug.'
    }
  },
  {
    id: 'datadog-systemd-route-flush',
    lessons: ['cni-deep-dive', 'pod-networking', 'node-pressure-eviction', 'events-logs-metrics'],
    title: 'A host OS security update removed Kubernetes routing rules across clouds',
    sourceType: 'Public postmortem',
    sourceLabel: 'Datadog — March 8, 2023 platform-level incident',
    sourceUrl: 'https://www.datadoghq.com/blog/engineering/2023-03-08-deep-dive-into-platform-level-impact/',
    confidence: 'First-party public postmortem',
    summary: 'Datadog documented a multi-region, multi-cloud outage where a systemd-networkd restart on Ubuntu 22.04 flushed routing policy rules that Kubernetes/Cilium depended on. Hosts and Pods lost connectivity even though the Kubernetes API objects themselves had not changed.',
    symptoms: [
      'The outage appeared across multiple regions and cloud providers, making an ordinary single-region rollout failure unlikely.',
      'Affected nodes lost host connectivity, and Pods on AWS/Azure lost required source-routing behavior.',
      'Kubernetes networking rules that had existed on the host disappeared after systemd-networkd restarted.'
    ],
    evidence: [
      'The trigger was a host OS/security update, not a Kubernetes manifest change.',
      'CNI correctness depends on Linux routes, rules, interfaces, and host services outside the Kubernetes API object model.',
      'Different cloud auto-healing behavior changed the recovery path and blast radius.'
    ],
    rootCause: 'A systemd-networkd behavior removed routing policy rules that Cilium/Kubernetes networking relied on, disconnecting nodes and Pods.',
    takeaway: 'Kubernetes abstractions eventually terminate in host networking. When the failure crosses clusters/clouds simultaneously, search for shared dependencies below Kubernetes too: base image, OS package, kernel, runtime, or common automation.',
    challenge: {
      prompt: 'Pods and nodes lose connectivity across multiple clouds at nearly the same time, with no NetworkPolicy or Service changes. Which evidence would most strongly justify moving below the Kubernetes API layer?',
      choices: [
        'A recent host OS/network service update and missing ip rule/ip route entries on affected nodes',
        'A single Deployment has one NotReady replica',
        'One namespace has a ResourceQuota',
        'An HPA target changed from 70% to 75%'
      ],
      answer: 0,
      explanation: 'Cross-cloud correlation plus missing host routing state points to the node/OS networking layer rather than a namespace-scoped Kubernetes object.'
    }
  }
];

export function incidentsForLesson(lessonId) {
  return PRODUCTION_INCIDENTS.filter(incident => incident.lessons.includes(lessonId));
}
