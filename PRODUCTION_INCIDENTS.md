# Production incident learning layer

Learn Kubernetes uses public production incidents to bridge the gap between knowing a Kubernetes mechanism and diagnosing it under pressure.

## Teaching sequence

Each attached case follows the same learning loop:

```text
Learn the mechanism
      ↓
Read production symptoms
      ↓
Commit to a diagnosis
      ↓
Reveal the evidence
      ↓
Compare with the documented root cause
      ↓
Extract a reusable troubleshooting rule
```

The case appears after the related interactive lesson so the learner has enough mechanism knowledge to reason from evidence rather than memorize the answer.

## Source hierarchy

Cases are explicitly labeled by source quality.

1. **Public postmortem / public engineering incident** — preferred. First-party company write-ups are the strongest source for incident impact, timeline, root cause, and remediation.
2. **Stack Overflow case** — useful for concrete troubleshooting sequences and reproducible configuration mistakes. Treat the individual answer as community evidence and corroborate the Kubernetes mechanism independently.
3. **Reddit community report** — useful for operational patterns and failure modes that engineers encounter in practice. These are always labeled as community reports and are not treated as canonical postmortems.

We do not turn an anecdote into a stronger claim than its source supports. Cases with an unresolved root cause say so explicitly.

## Copyright and attribution

Incident text in the site is **paraphrased**, not copied. Every case links to its original public source so learners can read the full investigation in context.

Do not copy long source passages, screenshots, diagrams, or code from third-party posts into the repository unless their license clearly permits it and attribution requirements are satisfied.

## Current incident pack

The initial corpus covers these production patterns:

- CPU throttling despite low averaged CPU utilization
- stale conntrack / DNS forwarding state
- control-plane failure amplified by DNS coupling
- PodDisruptionBudget blocking a node drain
- container OOMKilled vs node-pressure eviction
- Service selector mismatch producing zero endpoints
- HPA utilization surprises caused by CPU request sizing
- registry outage causing ImagePullBackOff on restart
- PVC Bound / attach success followed by CSI node-side FailedMount
- readiness/liveness symptoms caused by shared DNS failure
- host OS networking changes deleting Kubernetes/Cilium routing state across clouds

The data lives in `src/data/production-incidents.js`. The reusable renderer is `src/ui/production-incidents.js`, and `src/production-incidents-runtime.js` attaches matching cases to lessons without coupling them to individual lesson modules.

## Adding a case

A new case must include:

- a stable unique ID
- one or more valid lesson IDs
- source type, label, and HTTPS source URL
- a source-confidence statement
- a paraphrased incident summary
- at least two symptoms
- at least two evidence points
- root cause, or an explicit statement that the public source did not conclusively establish one
- a reusable production takeaway
- exactly four challenge choices with one unambiguous best answer

Run:

```bash
npm run validate
```

CI validates incident IDs, lesson mappings, source metadata, challenge structure, JavaScript syntax, and the existing curriculum integrity checks.

## Curation rule

Prefer incidents that teach a boundary:

- scheduler vs runtime
- Kubernetes API state vs Linux/node state
- Service/EndpointSlice state vs dataplane forwarding
- control plane vs data plane
- PVC binding vs CSI node mount
- probe symptom vs underlying shared dependency
- voluntary disruption vs node-pressure/involuntary disruption

A useful case should make the learner ask **“which subsystem acted?”** before asking **“which YAML field should I change?”**.
