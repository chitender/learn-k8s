# Learn Kubernetes ⎈

**See it. Break it. Understand it.**

An interactive, beginner-first learning platform for Kubernetes fundamentals. The goal is not another wall of documentation: every lesson should build a mental model, visualize what Kubernetes/Linux is doing, let the learner change inputs, and then test understanding.

## What is live

The site currently contains **27 interactive lessons** across ten sections:

```text
01 Foundations
   ├── Why Kubernetes?
   ├── Cluster architecture
   └── Declarative desired state

02 Workloads
   ├── Pods & containers
   ├── Deployments & ReplicaSets
   └── Pod lifecycle & probes

03 Scheduling & Resources
   ├── CPU scheduling & throttling
   ├── Memory requests, limits & OOM
   └── Affinity, taints & tolerations

04 Networking
   ├── Pod networking
   ├── Services & kube-proxy
   └── DNS & Ingress

05 Storage
   ├── Volumes & persistence
   └── PV, PVC & StorageClass

06 Operations
   ├── kubectl troubleshooting
   ├── Events, logs & metrics
   └── HPA, VPA & Cluster Autoscaler

07 Configuration & Access
   ├── ConfigMaps & Secrets
   ├── Namespaces & RBAC
   └── ResourceQuota & LimitRange

08 Workload Patterns
   ├── Jobs & CronJobs
   ├── StatefulSets
   └── DaemonSets

09 Reliability & Security
   ├── PDBs & graceful termination
   └── NetworkPolicy

10 Packaging & Capstone
   ├── Helm chart mental model
   └── Production app capstone
```

Helm is intentionally labeled as an ecosystem packaging tool rather than a Kubernetes core API primitive.

## Learning philosophy

A strong lesson follows this sequence:

```text
Mental model → Visualization → Experiment → Break it → Inspect evidence → Challenge
```

Examples already implemented include:

- scheduling a Pod using requests while live CPU tells a different story
- visualizing cgroup v2 CPU quota and throttling
- creating controller drift and watching reconciliation repair it
- breaking readiness/liveness independently
- tracing Service, DNS and Ingress request paths
- comparing container restart, Pod replacement and persistent volume lifetimes
- testing RBAC authorization decisions
- submitting Pods against ResourceQuota and LimitRange constraints
- simulating Job completion, CronJob concurrency and StatefulSet stable identity
- changing DaemonSet node eligibility
- testing voluntary eviction against a PodDisruptionBudget
- progressively isolating traffic with NetworkPolicy
- rendering a simplified Helm chart from values
- assembling a production-style workload in a capstone review

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

Keep lessons modular. A lesson owns its interactive state/UI while the platform owns navigation and routing.

1. Create `src/modules/<lesson-id>.js` and export `mount(root, context)` plus optional `unmount()`.
2. Add the lesson to the appropriate section in `src/catalog.js`.
3. Mark it `status: 'ready'` only when a working module exists.
4. Add the dynamic loader in `lessonLoaders`.
5. Add a concise learner-facing description in `src/app.js`.

Avoid teaching syntax before explaining the mechanism. Prefer showing a failure mode over adding another paragraph.

## Run locally

Because JavaScript modules require an HTTP origin, use a simple local server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy with GitHub Pages

The repository uses GitHub Actions for Pages deployment. Pushes to `main` publish the static site when Pages is configured to use **GitHub Actions** as its source.

## Accuracy notes

Teaching simulations deliberately simplify implementation detail where required, and those simplifications should be labeled in the UI. Important examples:

- Kubernetes scheduler feasibility is based on requested resources rather than instantaneous utilization.
- Linux CPU quota examples use an idealized aggregate CPU-time model; real kernel execution is not perfectly synchronized.
- ConfigMap/Secret projected-volume updates are asynchronous; environment variables require a new container to receive changed values.
- Kubernetes Secrets are not made secure merely by base64 encoding; protect them with access control and appropriate encryption/storage practices.
- NetworkPolicy requires a networking implementation that enforces it.
- PodDisruptionBudgets constrain voluntary disruptions through eviction-aware workflows; they do not prevent all Pod loss.
- Helm renders/packages Kubernetes resources; Kubernetes controllers perform reconciliation after those resources are submitted.

Useful primary references:

- Kubernetes documentation: https://kubernetes.io/docs/
- Kubernetes resource management: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
- Kubernetes scheduler: https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/
- Kubernetes networking: https://kubernetes.io/docs/concepts/services-networking/
- Kubernetes storage: https://kubernetes.io/docs/concepts/storage/
- Kubernetes RBAC: https://kubernetes.io/docs/reference/access-authn-authz/rbac/
- Linux CFS bandwidth control: https://docs.kernel.org/scheduler/sched-bwc.html
- Linux cgroup v2: https://docs.kernel.org/admin-guide/cgroup-v2.html
- Helm docs: https://helm.sh/docs/

## Philosophy

A beginner should be able to answer **why Kubernetes behaved a certain way** before memorizing another command.
