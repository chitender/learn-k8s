const AKS_SNAPSHOT = `cpu.idle
0
cpu.max
200000 100000
cpu.max.burst
0
cpu.pressure
some avg10=0.00 avg60=0.00 avg300=0.00 total=119611
full avg10=0.00 avg60=0.00 avg300=0.00 total=83708
cpu.stat
usage_usec 26841185
user_usec 20193315
system_usec 6647869
nr_periods 13335
nr_throttled 0
throttled_usec 0
cpu.uclamp.max
max
cpu.uclamp.min
0.00
cpu.weight
100
cpu.weight.nice
0`;

let cleanup = [];

export function mount(root, { markComplete }) {
  const state = {
    tab: 'model',
    request: 0.5,
    limit: 2,
    period: 100,
    nodeCpus: 8,
    demand: 3,
    threads: 3,
    otherCpu: 1,
    nodes: [
      { name: 'node-a', capacity: 8, requested: 4.0, live: 1.2 },
      { name: 'node-b', capacity: 8, requested: 3.0, live: 0.9 },
      { name: 'node-c', capacity: 8, requested: 6.0, live: 1.5 }
    ]
  };

  root.innerHTML = `
    <div class="tabs" role="tablist" aria-label="CPU lesson sections">
      <button class="tab active" data-tab="model">① Mental model</button>
      <button class="tab" data-tab="scheduler">② Schedule a Pod</button>
      <button class="tab" data-tab="runtime">③ Run on Linux</button>
      <button class="tab" data-tab="inspect">④ Inspect cgroups</button>
      <button class="tab" data-tab="challenge">⑤ Challenge</button>
    </div>

    <section data-page="model"></section>
    <section data-page="scheduler" hidden></section>
    <section data-page="runtime" hidden></section>
    <section data-page="inspect" hidden></section>
    <section data-page="challenge" hidden></section>
  `;

  const pages = Object.fromEntries([...root.querySelectorAll('[data-page]')].map((el) => [el.dataset.page, el]));

  pages.model.innerHTML = `
    <div class="panel">
      <div class="eyebrow">The most important idea in this lesson</div>
      <h2 style="margin-top:8px">There are two CPU decisions, made at different times.</h2>
      <p class="hero-copy">Kubernetes decides <strong>where</strong> a Pod should run. After that, the Linux kernel decides <strong>when and how much</strong> its processes actually run.</p>
      <div class="grid-2" style="margin-top:20px">
        <div class="callout success" style="margin:0">
          <strong>1 · kube-scheduler → placement</strong>
          <p>Looks at Pod <strong>requests</strong> and node allocatable/requested resources when checking whether the Pod fits. Low live CPU does not magically make an over-requested node schedulable.</p>
        </div>
        <div class="callout warn" style="margin:0">
          <strong>2 · Linux + cgroups → runtime</strong>
          <p>Once bound, the container runtime configures cgroups. <strong>cpu.weight</strong> influences relative CPU share under contention; <strong>cpu.max</strong> can impose a hard bandwidth ceiling.</p>
        </div>
      </div>

      <div class="flow" style="margin-top:22px">
        ${['PodSpec|request + limit','Filter|does request fit?','Score + bind|pick a node','kubelet/runtime|create cgroups','Linux scheduler|run threads','CPU controller|throttle if quota ends'].map((item, index) => {
          const [title, detail] = item.split('|');
          return `<button class="flow-step ${index === 0 ? 'active' : ''}" data-flow="${index}"><strong>${index + 1}. ${title}</strong><small>${detail}</small></button>`;
        }).join('')}
      </div>
      <div id="flow-detail" class="callout" style="margin-top:12px"></div>
    </div>

    <div class="grid-3" style="margin-top:14px">
      <div class="metric"><span>CPU request</span><strong>Scheduling promise</strong><p style="color:var(--muted);font-size:12px;margin:5px 0 0">Used for placement; typically maps to relative runtime weight.</p></div>
      <div class="metric"><span>CPU limit</span><strong>Hard ceiling</strong><p style="color:var(--muted);font-size:12px;margin:5px 0 0">Implemented with Linux CPU bandwidth control when configured.</p></div>
      <div class="metric"><span>Node free CPU</span><strong>Not a limit override</strong><p style="color:var(--muted);font-size:12px;margin:5px 0 0">Idle cores cannot cancel a container's cgroup quota.</p></div>
    </div>
  `;

  const flowDetails = [
    ['PodSpec', 'You declare resources.requests.cpu and optionally resources.limits.cpu. They are not synonyms.'],
    ['Filter', 'The scheduler rejects nodes where the new Pod request would exceed the node’s allocatable CPU after existing requests are accounted for.'],
    ['Score + bind', 'Feasible nodes are scored by scheduler plugins, then the Pod is bound to one node. This lab simplifies scoring so you can focus on resource accounting.'],
    ['kubelet/runtime', 'On the chosen node, kubelet and the container runtime create/configure cgroups for the Pod and containers.'],
    ['Linux scheduler', 'Runnable application threads compete for logical CPUs. A multi-threaded process can run on several CPUs at the same wall-clock instant.'],
    ['CPU bandwidth', 'If a cgroup exhausts its quota before the period ends, its runnable work is throttled until quota is replenished.']
  ];

  function renderFlow(index) {
    pages.model.querySelectorAll('[data-flow]').forEach((el, i) => el.classList.toggle('active', i === index));
    const [title, text] = flowDetails[index];
    pages.model.querySelector('#flow-detail').innerHTML = `<strong>${title}</strong><p>${text}</p>`;
  }
  renderFlow(0);
  pages.model.querySelectorAll('[data-flow]').forEach((el) => {
    const fn = () => renderFlow(Number(el.dataset.flow));
    el.addEventListener('click', fn); cleanup.push(() => el.removeEventListener('click', fn));
  });

  pages.scheduler.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="eyebrow">PodSpec</div><h2 style="margin-top:7px">Ask kube-scheduler to place me</h2>
        <div class="control" style="margin-top:20px"><label><span>CPU request</span><strong id="sched-request-label"></strong></label><input id="sched-request" type="range" min="0" max="8" step="0.25" value="0.5"></div>
        <div class="control"><label><span>CPU limit</span><strong id="sched-limit-label"></strong></label><input id="sched-limit" type="range" min="0.25" max="8" step="0.25" value="2"></div>
        <div class="chip-row">
          <button class="chip-btn" data-scenario="normal">Easy fit</button>
          <button class="chip-btn" data-scenario="idle-pending">Idle but Pending</button>
          <button class="chip-btn" data-scenario="burst">Burst-friendly</button>
        </div>
        <div class="math-box" id="pod-yaml"></div>
      </div>
      <div class="panel">
        <div class="eyebrow">Scheduler view</div><h2 style="margin-top:7px">Requests decide whether it fits</h2>
        <div class="node-grid" id="node-grid" style="margin-top:20px"></div>
        <div id="scheduler-result"></div>
      </div>
    </div>
  `;

  function cpuLabel(value) { return value < 1 ? `${Math.round(value * 1000)}m` : `${Number(value.toFixed(2))} CPU`; }
  function pct(value, max) { return Math.max(0, Math.min(100, value / max * 100)); }

  function renderScheduler() {
    pages.scheduler.querySelector('#sched-request').value = String(state.request);
    pages.scheduler.querySelector('#sched-limit').value = String(state.limit);
    pages.scheduler.querySelector('#sched-request-label').textContent = cpuLabel(state.request);
    pages.scheduler.querySelector('#sched-limit-label').textContent = cpuLabel(state.limit);
    pages.scheduler.querySelector('#pod-yaml').innerHTML = `<span style="color:var(--muted)">resources:</span><br>&nbsp;&nbsp;requests:<br>&nbsp;&nbsp;&nbsp;&nbsp;cpu: <span style="color:var(--cyan)">${state.request < 1 ? `${Math.round(state.request * 1000)}m` : state.request}</span><br>&nbsp;&nbsp;limits:<br>&nbsp;&nbsp;&nbsp;&nbsp;cpu: <span style="color:var(--amber)">${state.limit}</span>`;

    const feasible = state.nodes.filter((node) => node.requested + state.request <= node.capacity);
    const selected = feasible.length ? [...feasible].sort((a,b) => a.requested - b.requested)[0] : null;

    pages.scheduler.querySelector('#node-grid').innerHTML = state.nodes.map((node) => {
      const fits = node.requested + state.request <= node.capacity;
      return `<div class="node ${selected?.name === node.name ? 'selected' : ''}">
        <div class="node-head"><strong>${node.name}</strong><span>${fits ? '✓ feasible' : '✕ no fit'}</span></div>
        <div class="node-row"><span>Existing requests</span><strong>${cpuLabel(node.requested)} / ${node.capacity} CPU</strong></div>
        <div class="bar req"><i style="width:${pct(node.requested,node.capacity)}%"></i></div>
        <div class="node-row"><span>Live usage right now</span><strong>${cpuLabel(node.live)} / ${node.capacity} CPU</strong></div>
        <div class="bar live"><i style="width:${pct(node.live,node.capacity)}%"></i></div>
        <div class="node-row" style="margin-top:11px"><span>Unrequested headroom</span><strong>${cpuLabel(node.capacity-node.requested)}</strong></div>
        <div class="node-row"><span>Idle right now</span><strong>${cpuLabel(node.capacity-node.live)}</strong></div>
      </div>`;
    }).join('');

    const result = pages.scheduler.querySelector('#scheduler-result');
    if (selected) {
      result.innerHTML = `<div class="callout success"><strong>Scheduled → ${selected.name}</strong><p>Simplified lab scoring picks the feasible node with the most unrequested CPU. On ${selected.name}: ${cpuLabel(selected.requested)} existing requests + ${cpuLabel(state.request)} new request ≤ ${selected.capacity} CPU capacity.</p></div>`;
    } else {
      const idlest = [...state.nodes].sort((a,b) => a.live-b.live)[0];
      result.innerHTML = `<div class="callout danger"><strong>Pod stays Pending — even though ${idlest.name} is mostly idle.</strong><p>${idlest.name} is using only ${cpuLabel(idlest.live)} right now, but kube-scheduler's resource fit check is based on requests. It has ${cpuLabel(idlest.capacity-idlest.requested)} unrequested CPU and this Pod asks for ${cpuLabel(state.request)}.</p></div>`;
    }
  }

  const onSchedRequest = (e) => { state.request = Number(e.target.value); renderScheduler(); renderRuntime(); };
  const onSchedLimit = (e) => { state.limit = Number(e.target.value); renderScheduler(); renderRuntime(); };
  pages.scheduler.querySelector('#sched-request').addEventListener('input', onSchedRequest);
  pages.scheduler.querySelector('#sched-limit').addEventListener('input', onSchedLimit);
  cleanup.push(() => pages.scheduler.querySelector('#sched-request')?.removeEventListener('input', onSchedRequest));
  cleanup.push(() => pages.scheduler.querySelector('#sched-limit')?.removeEventListener('input', onSchedLimit));
  pages.scheduler.querySelectorAll('[data-scenario]').forEach((btn) => {
    const fn = () => {
      if (btn.dataset.scenario === 'normal') {
        state.request=.5; state.limit=2; state.nodes=[{name:'node-a',capacity:8,requested:4,live:1.2},{name:'node-b',capacity:8,requested:3,live:.9},{name:'node-c',capacity:8,requested:6,live:1.5}];
      } else if (btn.dataset.scenario === 'idle-pending') {
        state.request=2; state.limit=3; state.nodes=[{name:'node-a',capacity:8,requested:6.5,live:1},{name:'node-b',capacity:8,requested:7,live:.8},{name:'node-c',capacity:8,requested:6.25,live:1.1}];
      } else {
        state.request=.5; state.limit=4; state.nodes=[{name:'node-a',capacity:8,requested:4,live:1},{name:'node-b',capacity:8,requested:2.5,live:.7},{name:'node-c',capacity:8,requested:5,live:1.2}];
      }
      renderScheduler(); renderRuntime();
    };
    btn.addEventListener('click', fn); cleanup.push(() => btn.removeEventListener('click', fn));
  });
  renderScheduler();

  pages.runtime.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="eyebrow">Linux runtime controls</div><h2 style="margin-top:7px">Burn the cgroup budget</h2>
        <p style="color:var(--muted);font-size:13px">Start with your AKS-style <code>cpu.max = 200000 100000</code>, then change parallelism and demand.</p>
        <div class="control"><label><span>CPU limit</span><strong id="rt-limit-label"></strong></label><input id="rt-limit" type="range" min="0.5" max="8" step="0.5" value="2"></div>
        <div class="control"><label><span>Bandwidth period</span><strong id="rt-period-label"></strong></label><input id="rt-period" type="range" min="10" max="250" step="10" value="100"></div>
        <div class="control"><label><span>Application CPU demand</span><strong id="rt-demand-label"></strong></label><input id="rt-demand" type="range" min="0.5" max="8" step="0.5" value="3"></div>
        <div class="control"><label><span>Runnable worker threads</span><strong id="rt-threads-label"></strong></label><input id="rt-threads" type="range" min="1" max="16" step="1" value="3"></div>
        <div class="control"><label><span>Other workloads on node</span><strong id="rt-other-label"></strong></label><input id="rt-other" type="range" min="0" max="7" step="0.5" value="1"></div>
        <div class="chip-row">
          <button class="chip-btn active" data-runtime="aks">Your AKS cgroup</button>
          <button class="chip-btn" data-runtime="throttle">Free CPU + throttle</button>
          <button class="chip-btn" data-runtime="single">Single thread</button>
          <button class="chip-btn" data-runtime="burst">High limit</button>
        </div>
      </div>
      <div>
        <div class="panel">
          <div class="eyebrow">Derived cgroup configuration</div>
          <div class="grid-3" style="margin-top:13px">
            <div class="metric"><span>cpu.max</span><strong id="cpu-max-derived"></strong></div>
            <div class="metric"><span>Node CPU available</span><strong id="node-free-derived"></strong></div>
            <div class="metric"><span>Max runnable in parallel</span><strong id="parallel-derived"></strong></div>
          </div>
          <div id="runtime-result"></div>
        </div>
        <div class="panel" style="margin-top:14px">
          <div class="eyebrow">Continuous wall-clock view</div><h2 style="margin-top:7px">One bandwidth period</h2>
          <p style="color:var(--muted);font-size:12px">No fake “10 ms CFS slices”. The bar is continuous wall-clock time. Real kernel execution is less tidy than this idealized teaching model.</p>
          <div class="runtime-canvas"><div class="timeline"><div class="axis" id="runtime-axis"></div><div id="cpu-lanes"></div><div class="quota-ruler"><div class="bar quota"><i id="quota-fill"></i></div><div class="labels"><span>0 CPU-time consumed</span><span id="quota-label"></span></div></div></div></div>
          <div class="math-box" id="runtime-math"></div>
        </div>
      </div>
    </div>
  `;

  function runtimeMath() {
    const freeCpu = Math.max(0, state.nodeCpus - state.otherCpu);
    const parallel = Math.max(0, Math.min(state.threads, state.demand, freeCpu, state.nodeCpus));
    const quotaCpuMs = state.limit * state.period;
    const throttles = parallel > state.limit && state.demand > state.limit;
    const runWallMs = throttles ? Math.min(state.period, quotaCpuMs / parallel) : state.period;
    return { freeCpu, parallel, quotaCpuMs, throttles, runWallMs };
  }

  function renderRuntime() {
    if (!pages.runtime.querySelector('#rt-limit')) return;
    const m = runtimeMath();
    pages.runtime.querySelector('#rt-limit').value = state.limit;
    pages.runtime.querySelector('#rt-period').value = state.period;
    pages.runtime.querySelector('#rt-demand').value = state.demand;
    pages.runtime.querySelector('#rt-threads').value = state.threads;
    pages.runtime.querySelector('#rt-other').value = state.otherCpu;
    pages.runtime.querySelector('#rt-limit-label').textContent = cpuLabel(state.limit);
    pages.runtime.querySelector('#rt-period-label').textContent = `${state.period} ms`;
    pages.runtime.querySelector('#rt-demand-label').textContent = cpuLabel(state.demand);
    pages.runtime.querySelector('#rt-threads-label').textContent = state.threads;
    pages.runtime.querySelector('#rt-other-label').textContent = cpuLabel(state.otherCpu);
    const quotaUs = Math.round(state.limit * state.period * 1000);
    const periodUs = Math.round(state.period * 1000);
    pages.runtime.querySelector('#cpu-max-derived').textContent = `${quotaUs} ${periodUs}`;
    pages.runtime.querySelector('#node-free-derived').textContent = cpuLabel(m.freeCpu);
    pages.runtime.querySelector('#parallel-derived').textContent = cpuLabel(m.parallel);

    const axis = pages.runtime.querySelector('#runtime-axis');
    axis.innerHTML = [0,25,50,75,100].map((p) => `<span style="left:${p}%">${Number((state.period*p/100).toFixed(1))}ms</span>`).join('');

    const activeLanes = Math.ceil(m.parallel);
    pages.runtime.querySelector('#cpu-lanes').innerHTML = Array.from({length: state.nodeCpus}, (_, cpu) => {
      const active = cpu < activeLanes;
      const runPct = active ? Math.min(100, m.runWallMs/state.period*100) : 0;
      const throttlePct = active && m.throttles ? Math.max(0,100-runPct) : 0;
      const text = active ? (m.throttles ? `RUN → throttled at ~${m.runWallMs.toFixed(1)}ms` : 'RUN when scheduled') : (cpu < Math.ceil(state.otherCpu) ? 'other workload / contention' : 'idle / available');
      return `<div class="cpu-lane"><div class="cpu-label">CPU ${cpu}</div><div class="lane-track">${active ? `<div class="run-segment" style="width:${runPct}%"></div>` : ''}${throttlePct ? `<div class="throttle-segment" style="width:${throttlePct}%"></div>` : ''}<div class="lane-text">${text}</div></div></div>`;
    }).join('');

    pages.runtime.querySelector('#quota-fill').style.width = m.throttles ? '100%' : `${Math.min(100,m.parallel/state.limit*100)}%`;
    pages.runtime.querySelector('#quota-label').textContent = `${Number(m.quotaCpuMs.toFixed(1))} ms CPU-time quota`;

    const result = pages.runtime.querySelector('#runtime-result');
    if (m.throttles) {
      result.innerHTML = `<div class="callout danger"><strong>THROTTLED with ${cpuLabel(m.freeCpu)} available on the node</strong><p>The cgroup can execute roughly ${cpuLabel(m.parallel)} in parallel, so it can burn ${Number(m.quotaCpuMs.toFixed(1))} ms of aggregate CPU budget in about ${m.runWallMs.toFixed(1)} ms of wall time. The container then waits for replenishment even if CPUs remain idle.</p></div>`;
    } else if (m.freeCpu < state.demand) {
      result.innerHTML = `<div class="callout warn"><strong>Node contention is the bottleneck</strong><p>The app wants ${cpuLabel(state.demand)}, but only ${cpuLabel(m.freeCpu)} is available after other workloads. This is where relative CPU weighting matters.</p></div>`;
    } else {
      result.innerHTML = `<div class="callout success"><strong>No quota throttling in this configuration</strong><p>Demand/parallelism is not burning the configured ${cpuLabel(state.limit)} bandwidth ceiling before the period ends.</p></div>`;
    }

    pages.runtime.querySelector('#runtime-math').innerHTML = m.throttles
      ? `<span style="color:var(--muted)">cpu.max</span> = ${quotaUs} ${periodUs}<br><span style="color:var(--muted)">CPU budget</span> = ${state.limit} CPU × ${state.period}ms = ${m.quotaCpuMs.toFixed(1)}ms CPU-time<br><span style="color:var(--muted)">Parallel burn</span> ≈ ${m.parallel.toFixed(1)} CPU<br><span style="color:var(--cyan)">Theoretical throttle point ≈ ${m.quotaCpuMs.toFixed(1)} ÷ ${m.parallel.toFixed(1)} = ${m.runWallMs.toFixed(1)}ms wall time</span><br><br><span style="color:var(--muted)">Important: this is an idealized model. Kernel bandwidth is assigned to per-CPU run queues in smaller slices, so production traces will not look perfectly synchronized.</span>`
      : `<span style="color:var(--muted)">cpu.max</span> = ${quotaUs} ${periodUs}<br><span style="color:var(--muted)">CPU budget</span> = ${state.limit} CPU × ${state.period}ms = ${m.quotaCpuMs.toFixed(1)}ms CPU-time<br><span style="color:var(--green)">Quota survives the period → no theoretical bandwidth throttle.</span>`;
  }

  ['limit','period','demand','threads','other'].forEach((name) => {
    const el = pages.runtime.querySelector(`#rt-${name}`);
    const fn = (e) => {
      const key = name === 'other' ? 'otherCpu' : name;
      state[key] = Number(e.target.value); renderRuntime();
    };
    el.addEventListener('input', fn); cleanup.push(() => el.removeEventListener('input', fn));
  });

  pages.runtime.querySelectorAll('[data-runtime]').forEach((btn) => {
    const fn = () => {
      pages.runtime.querySelectorAll('[data-runtime]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.runtime === 'aks') { state.limit=2; state.period=100; state.demand=3; state.threads=3; state.otherCpu=1; }
      if (btn.dataset.runtime === 'throttle') { state.limit=1; state.period=100; state.demand=3; state.threads=3; state.otherCpu=1; }
      if (btn.dataset.runtime === 'single') { state.limit=2; state.period=100; state.demand=4; state.threads=1; state.otherCpu=0; }
      if (btn.dataset.runtime === 'burst') { state.limit=6; state.period=100; state.demand=4; state.threads=4; state.otherCpu=1; }
      renderRuntime();
    };
    btn.addEventListener('click', fn); cleanup.push(() => btn.removeEventListener('click', fn));
  });
  renderRuntime();

  pages.inspect.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="eyebrow">Paste real Linux output</div><h2 style="margin-top:7px">cgroup v2 inspector</h2>
        <p style="color:var(--muted);font-size:13px">Paste the output of <code>for file in cpu.*; do echo $file; cat $file; done</code>. This starts with the AKS snapshot from our discussion.</p>
        <div class="control"><textarea id="cgroup-input" spellcheck="false"></textarea></div>
        <div class="chip-row"><button class="primary-btn" id="inspect-btn">Explain this cgroup</button><button class="chip-btn" id="reset-inspector">Load AKS example</button></div>
      </div>
      <div class="panel">
        <div class="eyebrow">What Linux is telling you</div><h2 style="margin-top:7px">Decoded</h2>
        <div class="inspector-results" id="inspector-results" style="margin-top:18px"></div>
        <div id="inspector-explanation"></div>
      </div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="eyebrow">Useful production checks</div>
      <div class="grid-3" style="margin-top:12px">
        <div class="math-box" style="margin:0">cat /sys/fs/cgroup/cpu.max<br>cat /sys/fs/cgroup/cpu.stat</div>
        <div class="math-box" style="margin:0">cat /sys/fs/cgroup/cpu.weight<br>cat /sys/fs/cgroup/cpuset.cpus.effective</div>
        <div class="math-box" style="margin:0">kubectl get pod &lt;pod&gt; -o yaml<br># compare requests vs limits</div>
      </div>
    </div>
  `;

  const inspectorInput = pages.inspect.querySelector('#cgroup-input');
  inspectorInput.value = AKS_SNAPSHOT;

  function parseCgroup(text) {
    const lineValue = (name) => {
      const re = new RegExp(`${name.replace('.', '\\.') }\\s*\\n([^\\n]+)`, 'i');
      return text.match(re)?.[1]?.trim() ?? null;
    };
    const stat = (name) => Number(text.match(new RegExp(`(?:^|\\n)${name}\\s+(\\d+)`, 'm'))?.[1] ?? NaN);
    const cpuMaxRaw = lineValue('cpu.max');
    let quota = null, period = null, cpuLimit = null;
    if (cpuMaxRaw) {
      const [q,p] = cpuMaxRaw.split(/\s+/);
      quota = q === 'max' ? 'max' : Number(q);
      period = Number(p);
      if (quota !== 'max' && Number.isFinite(quota) && Number.isFinite(period) && period > 0) cpuLimit = quota / period;
    }
    const nrPeriods = stat('nr_periods');
    const nrThrottled = stat('nr_throttled');
    const throttledUsec = stat('throttled_usec');
    const usageUsec = stat('usage_usec');
    const weight = Number(lineValue('cpu.weight'));
    const psiSome = Number(text.match(/some\s+avg10=([\d.]+)/)?.[1] ?? NaN);
    const cpuset = lineValue('cpuset.cpus.effective');
    return { cpuMaxRaw, quota, period, cpuLimit, nrPeriods, nrThrottled, throttledUsec, usageUsec, weight, psiSome, cpuset };
  }

  function inspect() {
    const d = parseCgroup(inspectorInput.value);
    const cards = [
      ['CPU hard limit', d.cpuLimit == null ? (d.quota === 'max' ? 'Unlimited' : 'Not found') : `${Number(d.cpuLimit.toFixed(2))} CPU`],
      ['Quota period', Number.isFinite(d.period) ? `${d.period/1000} ms` : 'Not found'],
      ['nr_throttled', Number.isFinite(d.nrThrottled) ? d.nrThrottled.toLocaleString() : 'Not found'],
      ['throttled_usec', Number.isFinite(d.throttledUsec) ? `${d.throttledUsec.toLocaleString()} µs` : 'Not found'],
      ['CPU weight', Number.isFinite(d.weight) ? d.weight : 'Not found'],
      ['CPU PSI avg10', Number.isFinite(d.psiSome) ? d.psiSome.toFixed(2) : 'Not found'],
      ['usage_usec', Number.isFinite(d.usageUsec) ? d.usageUsec.toLocaleString() : 'Not found'],
      ['Effective cpuset', d.cpuset || 'Not included']
    ];
    pages.inspect.querySelector('#inspector-results').innerHTML = cards.map(([k,v]) => `<div class="kv"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');

    let html = '';
    if (d.cpuLimit != null) html += `<div class="callout"><strong>cpu.max → ${Number(d.cpuLimit.toFixed(2))} CPU ceiling</strong><p>${d.quota} µs quota ÷ ${d.period} µs period = ${Number(d.cpuLimit.toFixed(2))} CPU average bandwidth. This is the hard runtime ceiling for this cgroup.</p></div>`;
    if (d.nrThrottled === 0) html += `<div class="callout success"><strong>No quota throttling observed in this snapshot</strong><p><code>nr_throttled=0</code> and <code>throttled_usec=0</code>. Based on this cgroup snapshot, CPU-limit throttling is not supported as the cause of current slowness.</p></div>`;
    else if (Number.isFinite(d.nrThrottled)) {
      const ratio = Number.isFinite(d.nrPeriods) && d.nrPeriods > 0 ? d.nrThrottled/d.nrPeriods*100 : null;
      html += `<div class="callout danger"><strong>Quota throttling has occurred</strong><p>The cgroup reports ${d.nrThrottled.toLocaleString()} throttle events${ratio == null ? '' : `; nr_throttled / nr_periods ≈ ${ratio.toFixed(1)}%`}. That ratio is not “percent CPU throttled”; inspect throttled time and workload latency together.</p></div>`;
    }
    if (d.weight === 100) html += `<div class="callout warn"><strong>cpu.weight=100 does not prove the Kubernetes request was 100m</strong><p>100 is the default cgroup v2 weight. Inspect the PodSpec for the actual Kubernetes CPU request; do not reverse-engineer it from this number alone.</p></div>`;
    if (Number.isFinite(d.psiSome)) html += `<div class="callout"><strong>CPU pressure avg10 = ${d.psiSome.toFixed(2)}</strong><p>PSI describes recent CPU stall pressure, which is different from hitting <code>cpu.max</code>. Zero recent PSI plus zero throttling is a strong hint to investigate other bottlenecks too.</p></div>`;
    pages.inspect.querySelector('#inspector-explanation').innerHTML = html || `<div class="callout warn"><strong>Could not decode enough fields</strong><p>Include labels such as <code>cpu.max</code>, <code>cpu.stat</code> and <code>cpu.weight</code> before their values.</p></div>`;
  }

  const onInspect = () => inspect();
  const onReset = () => { inspectorInput.value = AKS_SNAPSHOT; inspect(); };
  pages.inspect.querySelector('#inspect-btn').addEventListener('click', onInspect);
  pages.inspect.querySelector('#reset-inspector').addEventListener('click', onReset);
  cleanup.push(() => pages.inspect.querySelector('#inspect-btn')?.removeEventListener('click', onInspect));
  cleanup.push(() => pages.inspect.querySelector('#reset-inspector')?.removeEventListener('click', onReset));
  inspect();

  pages.challenge.innerHTML = `
    <div class="panel">
      <div class="eyebrow">Test the mental model</div><h2 style="margin-top:7px">Three traps Kubernetes beginners hit</h2>
      <p style="color:var(--muted)">Choose an answer. The point is not the score — it is whether you can predict the system before looking at dashboards.</p>
      <div id="quiz" style="margin-top:18px"></div>
      <div class="chip-row" style="margin-top:18px"><button class="primary-btn" data-mark-complete>Mark lesson complete</button><button class="chip-btn" id="restart-quiz">Reset challenge</button></div>
    </div>
  `;

  const questions = [
    { q:'An 8-CPU node is using only 1 CPU live, but existing Pod requests total 7.5 CPU. A new Pod requests 1 CPU. What happens?', a:1, options:['Scheduler sees 7 free CPUs and places it','Pod can remain Pending because only 0.5 CPU is unrequested','Linux throttles the new Pod to 0.5 CPU'], why:'kube-scheduler resource fit uses requests, not instantaneous utilization.' },
    { q:'A container shows cpu.max = 200000 100000. What hard CPU bandwidth does that represent?', a:2, options:['200 CPU','0.5 CPU','2 CPU'], why:'200,000 µs quota ÷ 100,000 µs period = 2 CPU.' },
    { q:'A 2-CPU-limited cgroup has four CPU-hungry threads, at least 4 CPUs available, and a 100 ms period. In the idealized model, roughly when can quota be exhausted?', a:0, options:['Around 50 ms wall time','Exactly 100 ms wall time','It cannot throttle because the node has free CPUs'], why:'2 CPU × 100 ms = 200 ms aggregate CPU budget; 4 CPUs can burn 200 ms CPU-time in about 50 ms wall time.' }
  ];

  function renderQuiz() {
    pages.challenge.querySelector('#quiz').innerHTML = questions.map((item, qi) => `<div class="quiz-card"><p><strong>${qi+1}. ${item.q}</strong></p><div class="quiz-options">${item.options.map((option,oi) => `<button data-q="${qi}" data-o="${oi}">${option}</button>`).join('')}</div><div class="quiz-feedback" id="feedback-${qi}"></div></div>`).join('');
    pages.challenge.querySelectorAll('[data-q]').forEach((btn) => {
      const fn = () => {
        const qi = Number(btn.dataset.q), oi = Number(btn.dataset.o), item = questions[qi];
        const card = btn.closest('.quiz-card');
        card.querySelectorAll('[data-q]').forEach((b) => { b.classList.remove('correct','wrong'); b.disabled = true; });
        btn.classList.add(oi === item.a ? 'correct' : 'wrong');
        if (oi !== item.a) card.querySelector(`[data-o="${item.a}"]`).classList.add('correct');
        card.querySelector(`#feedback-${qi}`).textContent = `${oi === item.a ? '✓ Correct. ' : 'Not quite. '}${item.why}`;
      };
      btn.addEventListener('click', fn);
    });
  }
  renderQuiz();
  const completeBtn = pages.challenge.querySelector('[data-mark-complete]');
  const completeFn = () => markComplete();
  completeBtn.addEventListener('click', completeFn); cleanup.push(() => completeBtn.removeEventListener('click', completeFn));
  const restartBtn = pages.challenge.querySelector('#restart-quiz');
  const restartFn = () => renderQuiz();
  restartBtn.addEventListener('click', restartFn); cleanup.push(() => restartBtn.removeEventListener('click', restartFn));

  root.querySelectorAll('[data-tab]').forEach((tab) => {
    const fn = () => {
      state.tab = tab.dataset.tab;
      root.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === state.tab));
      Object.entries(pages).forEach(([name, page]) => { page.hidden = name !== state.tab; });
      if (state.tab === 'runtime') renderRuntime();
    };
    tab.addEventListener('click', fn); cleanup.push(() => tab.removeEventListener('click', fn));
  });
}

export function unmount() {
  cleanup.forEach((fn) => { try { fn(); } catch {} });
  cleanup = [];
}
