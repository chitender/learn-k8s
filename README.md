# Learn Kubernetes ⎈

**See it. Break it. Understand it.**

An interactive, beginner-first learning platform for Kubernetes core fundamentals. The goal is not another wall of documentation: every lesson should build a mental model, visualize what Kubernetes/Linux is doing, let the learner change inputs, and then test understanding.

## First live module

### CPU scheduling & throttling

The first lesson explains two different decisions that are often mixed together:

1. **Kubernetes scheduling** — where a Pod runs, primarily using resource requests for capacity checks.
2. **Linux CPU runtime** — when/how much container processes run, using cgroups, CPU weight and CPU bandwidth limits.

The lab includes:

- Node placement simulator using requests vs live CPU utilization
- `requests.cpu` vs `limits.cpu` mental model
- cgroup v2 `cpu.max` quota/period calculator
- Continuous wall-clock CPU-lane visualization (no fake 10 ms CFS slices)
- Thread parallelism and aggregate CPU-time quota burn
- Scenarios where a container throttles even while the node has idle CPUs
- Single-thread vs multi-thread behavior
- Real cgroup v2 inspector for pasted `cpu.*` output
- AKS example: `cpu.max = 200000 100000`, `nr_throttled = 0`
- Short challenge/quiz mode

## Curriculum structure

The site is intentionally organized as a growing learning path:

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
   ├── CPU scheduling & throttling  ✅
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
```

## Repository layout

```text
learn-k8s/
├── index.html                  # Static entry point
├── styles.css                  # Shared visual design system
├── src/
│   ├── app.js                  # Shell, navigation and lesson routing
│   ├── catalog.js              # Curriculum + lesson manifest
│   └── modules/
│       └── cpu-scheduling.js   # First interactive lesson
└── .github/workflows/
    └── pages.yml               # GitHub Pages deployment
```

## Add a new lesson

Keep lessons modular. A lesson should own its interactive state and UI, while the platform owns navigation and routing.

1. Create `src/modules/<lesson-id>.js` and export `mount(root, context)` plus optional `unmount()`.
2. Add the lesson to the right section in `src/catalog.js`.
3. Mark it `status: 'ready'`.
4. Add a loader in `lessonLoaders`.

A strong lesson should follow this sequence:

```text
Mental model → Visualization → Experiment → Real-world inspection → Challenge
```

Avoid teaching syntax before explaining the mechanism.

## Run locally

Because JavaScript modules require an HTTP origin, use any simple local server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy with GitHub Pages

The repository contains a GitHub Actions Pages workflow. In GitHub, open:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

After that, pushes to `main` deploy the static site.

## Accuracy / teaching notes

The CPU lesson deliberately separates simplified teaching visualizations from kernel implementation details. The quota timeline is an idealized model for understanding aggregate CPU-time consumption; the Linux kernel distributes CFS bandwidth to per-CPU run queues in smaller slices, so production execution is not expected to look perfectly synchronized.

Useful primary references:

- Kubernetes resource management: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
- Kubernetes scheduler: https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/
- Kubernetes cgroup v2: https://kubernetes.io/docs/concepts/architecture/cgroups/
- Linux CFS bandwidth control: https://docs.kernel.org/scheduler/sched-bwc.html
- Linux cgroup v2: https://docs.kernel.org/admin-guide/cgroup-v2.html

## Philosophy

A beginner should be able to answer **why** Kubernetes behaved a certain way before memorizing another command.
