# Learn Kubernetes ⎈

**See it. Break it. Understand it.**

An interactive, beginner-first learning platform for Kubernetes fundamentals and production internals. The goal is not another wall of documentation: every lesson should build a mental model, visualize what Kubernetes/Linux is doing, let the learner change inputs, and then test understanding.

## What is live

The site currently contains **36 interactive lessons** across eleven sections.

```text
01 Foundations
   Why Kubernetes? · Cluster architecture · Declarative desired state

02 Workloads
   Pods & containers · Deployments & ReplicaSets · Pod lifecycle & probes

03 Scheduling & Resources
   CPU scheduling & throttling · Memory & OOM · Affinity/taints
   Priority & preemption · Topology spread · Scheduler framework

04 Networking
   Pod networking · Services & kube-proxy · Service internals & EndpointSlices · DNS & Ingress

05 Storage
   Volumes & persistence · PV/PVC/StorageClass

06 Operations
   kubectl troubleshooting · Events/logs/metrics · Autoscaling · Node pressure & eviction

07 Configuration & Access
   ConfigMaps & Secrets · Namespaces & RBAC · ServiceAccounts & tokens · Quotas & LimitRanges

08 Workload Patterns
   Jobs & CronJobs · StatefulSets · DaemonSets

09 Reliability & Security
   PDBs & graceful termination · NetworkPolicy · Pod Security Admission

10 Packaging & Capstone
   Helm chart mental model · Production app capstone

11 API Machinery & Extensibility
   Admission control & webhooks · CRDs & operator pattern
```

Helm is intentionally labeled as an ecosystem packaging tool rather than a Kubernetes core API primitive.

## Learning philosophy

A strong lesson follows this sequence:

```text
Mental model → Visualization → Experiment → Break it → Inspect evidence → Challenge
```

Examples implemented include scheduling using requests while live CPU tells a different story, cgroup v2 CPU quota visualization, controller reconciliation, probe failures, Service/EndpointSlice forwarding, RBAC and ServiceAccount authorization, Pod Security Admission, topology spread, scheduler extension points, kubelet node-pressure eviction, CRD/operator reconciliation, and admission webhook failure behavior.

## Repository layout

```text
learn-k8s/
├── index.html
├── styles.css
├── src/
│   ├── app.js                  # shell, navigation and lesson routing
│   ├── catalog.js              # curriculum + lesson manifest
│   └── modules/                # one interactive module per lesson
└── .github/workflows/
    └── pages.yml               # GitHub Pages deployment
```

## Add a new lesson

1. Create `src/modules/<lesson-id>.js` and export `mount(root, context)` plus optional `unmount()`.
2. Add the lesson to the appropriate section in `src/catalog.js`.
3. Mark it `status: 'ready'` only when a working module exists.
4. Add the dynamic loader in `lessonLoaders`.
5. Add a concise learner-facing description in `src/app.js`.

Avoid teaching syntax before explaining the mechanism. Prefer showing a failure mode over adding another paragraph.

## Run locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy with GitHub Pages

The repository uses GitHub Actions for Pages deployment. Pushes to `main` publish the static site when Pages uses **GitHub Actions** as its source.

## Accuracy notes

Teaching simulations deliberately simplify implementation detail where required, and simplifications should be labeled in the UI.

- Scheduler feasibility is based on requested resources rather than instantaneous utilization.
- Linux CPU quota examples use an idealized aggregate CPU-time model; real execution is not perfectly synchronized.
- ConfigMap/Secret projected-volume updates are asynchronous; environment variables require a new container to receive changed values.
- Base64 does not make a Kubernetes Secret encrypted.
- NetworkPolicy requires a networking implementation that enforces it.
- PodDisruptionBudgets constrain voluntary disruptions through eviction-aware workflows; kubelet node-pressure eviction is a different mechanism.
- ServiceAccount projected tokens are time-bound and rotated; long-lived Secret-based tokens are discouraged.
- Pod Security Admission uses namespace policy levels and enforce/warn/audit modes; the lesson uses a simplified subset of real Pod Security Standard checks.
- kube-proxy implementation is version/platform dependent. Linux supports iptables, nftables and (in current releases) deprecated IPVS; Windows uses kernelspace mode.
- A CustomResourceDefinition adds API schema/storage; a controller is what turns that desired state into reconciliation behavior.
- Helm renders/packages Kubernetes resources; Kubernetes controllers reconcile those resources after submission.

## Primary references

- Kubernetes docs: https://kubernetes.io/docs/
- Scheduler framework: https://kubernetes.io/docs/concepts/scheduling-eviction/scheduling-framework/
- Service virtual IPs and proxies: https://kubernetes.io/docs/reference/networking/virtual-ips/
- Admission control: https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/
- Custom resources: https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/
- Operator pattern: https://kubernetes.io/docs/concepts/extend-kubernetes/operator/
- ServiceAccounts: https://kubernetes.io/docs/concepts/security/service-accounts/
- Pod Security Admission: https://kubernetes.io/docs/concepts/security/pod-security-admission/
- Node-pressure eviction: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
- Linux CFS bandwidth control: https://docs.kernel.org/scheduler/sched-bwc.html

## Philosophy

A beginner should be able to answer **why Kubernetes behaved a certain way** before memorizing another command.
