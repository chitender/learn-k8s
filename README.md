# Learn Kubernetes ⎈

**See it. Break it. Understand it.**

An interactive, beginner-first Kubernetes learning platform that grows from core mental models into production internals and SRE-style diagnosis. It is intentionally not another wall of YAML or command memorization: each lab explains the mechanism, gives the learner controls, creates a failure mode, and shows the evidence Kubernetes or Linux would expose.

## Current release

The site contains **51 interactive lessons** across thirteen sections and is validated against a **Kubernetes v1.37** content baseline (v1.37.0 released 2026-08-26; project content validation date 2026-09-10).

```text
01 Foundations
   Why Kubernetes? · Cluster architecture · Declarative desired state
   API object & YAML anatomy · Labels & selectors

02 Workloads
   Pods & containers · Deployments & ReplicaSets · Pod lifecycle & probes
   Init containers & native sidecars · Probes deep dive · Rolling updates deep dive

03 Scheduling & Resources
   CPU scheduling & throttling · Memory & OOM · Affinity/taints
   QoS classes & eviction ranking · Priority & preemption
   Topology spread · Scheduler framework

04 Networking
   Pod networking · CNI deep dive · Services & kube-proxy
   Service internals & EndpointSlices · DNS & Ingress

05 Storage
   Volumes & persistence · PV/PVC/StorageClass · CSI deep dive

06 Operations
   kubectl troubleshooting · Events/logs/metrics · Autoscaling
   Node pressure & eviction · Production incident simulator

07 Configuration & Access
   ConfigMaps & Secrets · Namespaces & RBAC · ServiceAccounts & tokens
   ResourceQuota & LimitRange

08 Workload Patterns
   Jobs & CronJobs · StatefulSets · DaemonSets

09 Reliability & Security
   PDBs & graceful termination · NetworkPolicy · Pod Security Admission

10 Packaging & Capstone
   Helm chart mental model · Production app capstone

11 API Machinery & Extensibility
   Admission control & webhooks · CRDs & operator pattern

12 Control Plane & Node Internals
   API server & etcd request lifecycle · Leases & leader election
   kubelet internals · CRI & container runtime

13 Practice & Mastery
   CKA / SRE challenge arena · Whole-cluster sandbox
```

Helm is deliberately presented as an ecosystem packaging tool rather than a Kubernetes core API primitive.

## Learning experience

The application stays static and backend-free while behaving like a learning product:

- **100 XP per completed lesson** plus one-time challenge bonus XP
- six ranks from **Pod Explorer** to **Control Plane Sage**
- achievements and progress by curriculum section
- prerequisite-aware recommended-next guidance without hard locks
- curriculum search plus level and completion filters
- collapsible desktop navigation and a mobile drawer
- dedicated **Progress & Achievements** page
- versioned JSON progress export/import/reset
- route-specific page titles, keyboard focus, skip navigation and reduced-motion support
- a searchable **Kubernetes glossary**
- per-lesson links to the official source used for validation
- no account, tracking backend, or server-side learner profile; progress stays in `localStorage`

## Learning tracks

The entire curriculum is always open, but three curated routes reduce decision fatigue:

- **🌱 Beginner Core** — object model → controllers → workloads → resources → networking → storage → debugging
- **⚔️ CKA Foundations** — operational workload, scheduling, networking, storage, security, and troubleshooting mechanics
- **🚨 Production SRE** — cgroups, QoS, scheduler internals, CNI/CSI, autoscaling, node pressure, control plane/node internals, and incidents

Tracks are guidance, not separate copies of content and not gates.

## Practice modes

### CKA / SRE Challenge Arena

Questions are data-driven (`src/data/challenges.js`) and can be filtered by track, domain, and difficulty. Answers explain the subsystem boundary instead of only marking the choice correct or incorrect. One-time bonus XP rewards solving rather than reloading.

### Whole-cluster Sandbox v2

The sandbox uses a reusable state engine rather than independent text toggles. Learners can:

- schedule new Pods using **request-based node feasibility**
- inspect feasible and rejected scheduler candidates
- change a Pod request, limit, and simulated CPU demand
- see the corresponding cgroup-v2-style `cpu.max` and idealized quota effect
- cordon, uncordon, drain, fail, and recover nodes
- break/repair a node network dataplane
- create Pending workloads and retry them after capacity changes
- observe readiness, EndpointSlice eligibility, and Service reachability separately
- drag a Pod to another node as an explicitly labeled **what-if placement test**
- send Service requests and correlate failures with a Kubernetes-style event stream

The drag action is not presented as a real Kubernetes primitive. It asks whether a placement *would* be feasible and is used only as a learning interaction.

## Learning philosophy

A strong lesson follows this sequence:

```text
Mental model → Visualization → Experiment → Break it → Inspect evidence → Challenge
```

The recurring diagnostic model is equally important:

```text
Symptom
  ↓
What evidence changed?
  ↓
Which subsystem owns that decision?
  ↓
Scheduler / API / controller / kubelet / CRI / CNI / CSI / Linux / application
```

## Accuracy baseline

Teaching simulations simplify implementation details when needed, but simplifications should be visible in the UI. Every ready lesson must also have an official reference in `src/data/lesson-resources.js` before validation succeeds.

Important assumptions and boundaries:

- Scheduler feasibility is based on requested resources rather than instantaneous node utilization.
- Linux CPU-limit examples use an idealized aggregate CPU-time model; a 100ms bandwidth period is not a 100ms task scheduling slice and the UI does not invent fixed 10ms CFS slices.
- CPU limits can throttle a cgroup even while node CPUs are idle; memory limits are enforced differently and can lead to OOM behavior rather than periodic CPU-style quota replenishment.
- QoS classes are derived from resource configuration and influence node-pressure behavior; they are not scheduler PriorityClasses.
- A toleration permits scheduling onto a matching taint; it does not force placement there.
- A Service is a stable networking abstraction whose endpoints are derived from selectors/readiness; it does not contain Pods.
- CNI, CRI, and CSI are interfaces. Exact dataplane/runtime/storage implementation is provider- and driver-specific.
- A PVC being `Bound` does not prove node-side attach or mount succeeded.
- The API server may serve reads from caches; etcd remains the authoritative backing store for Kubernetes API state.
- Base64 does not make a Kubernetes Secret encrypted.
- NetworkPolicy requires a networking implementation that enforces it.
- PodDisruptionBudgets constrain voluntary disruptions through eviction-aware flows; kubelet node-pressure eviction is a different mechanism.
- ServiceAccount projected tokens are time-bound and rotated; long-lived Secret-based tokens are discouraged.
- Pod Security Admission uses namespace policy levels plus enforce/warn/audit modes; the interactive lesson uses a simplified subset of the actual Pod Security Standards.
- kube-proxy implementation is version/platform dependent; learners should not treat one dataplane mode as universal.
- A CRD adds a custom API schema/resource; a controller/operator supplies the reconciliation behavior.
- Helm renders/packages Kubernetes resources; Kubernetes controllers reconcile the rendered resources after submission.
- In Kubernetes v1.37, HPA scale-to-zero is Beta and enabled by default. `minReplicas: 0` requires at least one Object or External metric; Pod resource metrics such as CPU/memory alone cannot wake a zero-replica workload.

## Repository layout

```text
learn-k8s/
├── index.html
├── styles.css
├── styles-experience.css
├── package.json
├── scripts/
│   └── validate.mjs             # zero-dependency curriculum/syntax integrity validation
├── src/
│   ├── app.js                   # shell, routing, pages and lesson loading
│   ├── catalog.js               # curriculum + loader manifest
│   ├── gamification.js          # XP, achievements, progress portability, prerequisites
│   ├── data/
│   │   ├── challenges.js
│   │   ├── glossary.js
│   │   ├── learning-tracks.js
│   │   ├── lesson-descriptions.js
│   │   └── lesson-resources.js  # official references + Kubernetes baseline
│   ├── sim/
│   │   └── cluster-engine.js    # reusable whole-cluster state/event engine
│   ├── ui/
│   │   ├── content-pages.js
│   │   └── learning-ui.js
│   └── modules/                 # one interactive module per lesson
└── .github/workflows/
    ├── validate.yml             # PR integrity validation
    └── pages.yml                # validate then deploy GitHub Pages
```

## Validation

No dependency install is required. With Node 20+:

```bash
npm run validate
```

The validator fails if, among other things:

- a ready lesson has no loader or module file
- a lesson module does not export `mount()`
- a ready lesson lacks learner-facing description or official reference
- lesson/section/challenge/glossary IDs collide
- prerequisites or learning tracks reference missing lessons
- a challenge answer index is invalid
- the README lesson count is stale
- any JavaScript module fails `node --check`

Pull requests run the validator, and the Pages workflow validates again before publishing.

## Add a lesson

1. Create `src/modules/<lesson-id>.js` and export `mount(root, context)` plus optional `unmount()`.
2. Add it to the correct section in `src/catalog.js`.
3. Add its dynamic loader to `lessonLoaders`.
4. Add concise learner-facing copy to `src/data/lesson-descriptions.js`.
5. Add at least one primary/official source to `src/data/lesson-resources.js`.
6. Add prerequisite guidance in `src/gamification.js` only when it materially helps the learning sequence.
7. Run `npm run validate`.
8. Mark lessons `ready` only when the interactive module exists and the validator passes.

Avoid teaching syntax before explaining the mechanism. Prefer an observable failure mode over another paragraph.

## Add a challenge

Add a challenge object to `src/data/challenges.js`. The Arena automatically reads its track, domain, difficulty, choices, answer, and explanation. `npm run validate` verifies IDs, difficulty, choices, and answer indexes.

## Run locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Run validation separately with:

```bash
npm run validate
```

## Deploy

GitHub Pages is deployed through GitHub Actions. A push to `main` runs the same validation gate first, then configures Pages, uploads the static artifact, and deploys it.

## Primary references

Lesson-specific primary sources are surfaced directly in the UI. The project primarily relies on:

- Kubernetes documentation: https://kubernetes.io/docs/
- Kubernetes release history: https://kubernetes.io/releases/
- Linux scheduler / CFS bandwidth documentation: https://docs.kernel.org/scheduler/sched-bwc.html
- Helm documentation: https://helm.sh/docs/

## Philosophy

A learner should be able to answer **why Kubernetes behaved a certain way** before memorizing another command.
