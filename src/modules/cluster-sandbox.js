let cleanup = [];

export function mount(root, { markComplete, awardXP }) {
  const state = {
    nodes: [
      { name:'node-a', cpu:8, requested:5.5, live:2.2, healthy:true, cni:true },
      { name:'node-b', cpu:8, requested:6.5, live:1.4, healthy:true, cni:true },
      { name:'node-c', cpu:4, requested:2.0, live:0.8, healthy:true, cni:true }
    ],
    request:1,
    limit:1,
    demand:1.5,
    replicas:4,
    ready:4,
    pending:0,
    selected:'node-c',
    serviceHits:0,
    failures:0,
    fault:'none'
  };

  root.innerHTML = `
    <div class="panel">
      <div class="eyebrow">Whole-cluster playground</div><h2>Cluster Sandbox</h2>
      <p class="hero-copy">Change scheduling inputs, node health, CNI reachability, readiness and runtime CPU demand. Watch the same application move through multiple Kubernetes subsystems.</p>
      <div class="chip-row">
        <button class="chip-btn fault active" data-fault="none">Healthy cluster</button>
        <button class="chip-btn fault" data-fault="node">Lose node-b</button>
        <button class="chip-btn fault" data-fault="cni">Break node-b CNI</button>
        <button class="chip-btn fault" data-fault="readiness">Break 2 readiness probes</button>
        <button class="chip-btn fault" data-fault="pressure">Fill scheduler requests</button>
      </div>
    </div>

    <div class="grid-2" style="margin-top:16px">
      <div class="panel">
        <div class="eyebrow">1 · Scheduler inputs</div>
        <div class="control"><label>New Pod CPU request <span id="req-v"></span></label><input id="request" type="range" min="0.25" max="4" step="0.25" value="1"></div>
        <div class="control"><label>CPU limit <span id="limit-v"></span></label><input id="limit" type="range" min="0.5" max="4" step="0.5" value="1"></div>
        <div class="control"><label>Application CPU demand <span id="demand-v"></span></label><input id="demand" type="range" min="0.25" max="6" step="0.25" value="1.5"></div>
        <button class="primary-btn" id="schedule">Schedule one new replica</button>
        <div id="schedule-out" class="callout"></div>
      </div>
      <div class="panel">
        <div class="eyebrow">Node view</div><div id="nodes" class="node-grid"></div>
      </div>
    </div>

    <div class="grid-3" style="margin-top:16px">
      <div class="panel"><div class="eyebrow">2 · Runtime</div><div id="runtime"></div></div>
      <div class="panel"><div class="eyebrow">3 · Service</div><div id="service"></div><button class="primary-btn" id="send" style="margin-top:12px">Send request</button></div>
      <div class="panel"><div class="eyebrow">4 · Observability</div><div id="observe"></div></div>
    </div>

    <div class="panel" style="margin-top:16px">
      <div class="eyebrow">Mechanism map</div>
      <div class="flow" style="grid-template-columns:repeat(7,minmax(120px,1fr))">
        <div class="flow-step active"><strong>PodSpec</strong><small>request + limit</small></div>
        <div class="flow-step active"><strong>Scheduler</strong><small>fit by requests</small></div>
        <div class="flow-step active"><strong>kubelet</strong><small>reconcile Pod</small></div>
        <div class="flow-step active"><strong>CNI</strong><small>network sandbox</small></div>
        <div class="flow-step active"><strong>cgroup</strong><small>CPU runtime</small></div>
        <div class="flow-step active"><strong>Service</strong><small>Ready endpoints</small></div>
        <div class="flow-step active"><strong>Metrics/events</strong><small>evidence</small></div>
      </div>
      <div class="callout warn"><strong>Key lesson</strong><p>A single user symptom can cross several mechanisms. “Requests fail” could mean no schedulable Pod, NotReady endpoints, broken CNI reachability, or a runtime bottleneck. Use subsystem boundaries to narrow the diagnosis.</p></div>
      <button class="primary-btn" data-mark-complete>Mark sandbox complete</button>
    </div>`;

  const $ = s => root.querySelector(s);

  function applyFault() {
    state.nodes = [
      { name:'node-a', cpu:8, requested:5.5, live:2.2, healthy:true, cni:true },
      { name:'node-b', cpu:8, requested:6.5, live:1.4, healthy:true, cni:true },
      { name:'node-c', cpu:4, requested:2.0, live:0.8, healthy:true, cni:true }
    ];
    state.ready = state.replicas;
    if (state.fault === 'node') state.nodes[1].healthy = false;
    if (state.fault === 'cni') state.nodes[1].cni = false;
    if (state.fault === 'readiness') state.ready = Math.max(0, state.replicas - 2);
    if (state.fault === 'pressure') state.nodes.forEach(n => n.requested = Math.max(0, n.cpu - 0.25));
  }

  function schedulableNodes() {
    return state.nodes.filter(n => n.healthy && (n.cpu - n.requested) >= state.request);
  }

  function render() {
    state.request = Number($('#request').value);
    state.limit = Number($('#limit').value);
    state.demand = Number($('#demand').value);
    $('#req-v').textContent = `${state.request} CPU`;
    $('#limit-v').textContent = `${state.limit} CPU`;
    $('#demand-v').textContent = `${state.demand} CPU`;

    $('#nodes').innerHTML = state.nodes.map(n => {
      const headroom = Math.max(0, n.cpu - n.requested);
      const status = !n.healthy ? 'NotReady' : !n.cni ? 'CNI broken' : 'Ready';
      return `<div class="node ${state.selected===n.name?'selected':''}"><div class="node-head"><strong>${n.name}</strong><span>${status}</span></div><div class="metric"><span>Allocatable CPU</span><strong>${n.cpu}</strong></div><div class="node-row"><span>Requested</span><span>${n.requested.toFixed(2)}</span></div><div class="bar req"><i style="width:${Math.min(100,n.requested/n.cpu*100)}%"></i></div><div class="node-row"><span>Live usage</span><span>${n.live.toFixed(2)}</span></div><div class="bar live"><i style="width:${Math.min(100,n.live/n.cpu*100)}%"></i></div><div class="node-row"><span>Scheduler headroom</span><span>${headroom.toFixed(2)}</span></div></div>`;
    }).join('');

    const throttling = state.demand > state.limit;
    $('#runtime').innerHTML = `<div class="metric"><span>Demand</span><strong>${state.demand} CPU</strong></div><div class="metric" style="margin-top:8px"><span>Limit</span><strong>${state.limit} CPU</strong></div><div class="callout ${throttling?'danger':'success'}"><strong>${throttling?'Throttle risk':'Within CPU limit'}</strong><p>${throttling?`Demand exceeds the cgroup bandwidth ceiling by ${(state.demand-state.limit).toFixed(2)} CPU.`:'This simplified workload demand is within the configured CPU limit.'}</p></div>`;

    const reachableReady = state.fault === 'cni' ? Math.max(0,state.ready-1) : state.ready;
    $('#service').innerHTML = `<div class="metric"><span>Replicas</span><strong>${state.replicas}</strong></div><div class="metric" style="margin-top:8px"><span>Ready endpoints</span><strong>${state.ready}</strong></div><div class="metric" style="margin-top:8px"><span>Reachable endpoints</span><strong>${reachableReady}</strong></div>`;

    const pendingReason = state.pending ? `${state.pending} Pending` : '0 Pending';
    $('#observe').innerHTML = `<div class="metric"><span>Scheduling</span><strong>${pendingReason}</strong></div><div class="metric" style="margin-top:8px"><span>Service requests</span><strong>${state.serviceHits}</strong></div><div class="metric" style="margin-top:8px"><span>Failures</span><strong>${state.failures}</strong></div><div class="terminal" style="margin-top:10px">Events: ${state.pending?'FailedScheduling':'normal'}\nCPU: ${throttling?'throttling possible':'normal'}\nCNI: ${state.fault==='cni'?'cross-node fault':'normal'}\nEndpoints: ${state.ready}/${state.replicas} Ready</div>`;
  }

  function scheduleOne() {
    const choices = schedulableNodes().sort((a,b)=>(b.cpu-b.requested)-(a.cpu-a.requested));
    if (!choices.length) {
      state.pending++;
      $('#schedule-out').className='callout danger';
      $('#schedule-out').innerHTML='<strong>Pod stays Pending</strong><p>No healthy node has enough unrequested CPU for the Pod request. Live CPU may still look low.</p>';
    } else {
      const n = choices[0];
      n.requested += state.request;
      n.live += Math.min(state.request, state.demand * 0.35);
      state.replicas++;
      state.ready++;
      state.selected=n.name;
      $('#schedule-out').className='callout success';
      $('#schedule-out').innerHTML=`<strong>Scheduled to ${n.name}</strong><p>Scheduler fit used request=${state.request} CPU against request headroom, not live CPU utilization.</p>`;
      if (awardXP) awardXP('sandbox:first-schedule',25);
    }
    render();
  }

  function sendRequest() {
    const reachableReady = state.fault === 'cni' ? Math.max(0,state.ready-1) : state.ready;
    state.serviceHits++;
    if (!reachableReady || state.fault === 'node' && state.ready < 1) state.failures++;
    if (state.fault === 'cni' && state.serviceHits % 3 === 0) state.failures++;
    if (state.fault === 'readiness' && state.ready === 0) state.failures++;
    render();
  }

  function chooseFault(e) {
    state.fault=e.currentTarget.dataset.fault;
    root.querySelectorAll('.fault').forEach(b=>b.classList.toggle('active',b===e.currentTarget));
    applyFault();
    state.pending=0; state.selected='';
    render();
  }

  root.querySelectorAll('input').forEach(el=>{el.addEventListener('input',render);cleanup.push(()=>el.removeEventListener('input',render));});
  root.querySelectorAll('.fault').forEach(el=>{el.addEventListener('click',chooseFault);cleanup.push(()=>el.removeEventListener('click',chooseFault));});
  $('#schedule').addEventListener('click',scheduleOne); $('#send').addEventListener('click',sendRequest);
  cleanup.push(()=>$('#schedule')?.removeEventListener('click',scheduleOne),()=>$('#send')?.removeEventListener('click',sendRequest));
  const done=()=>markComplete(); root.querySelector('[data-mark-complete]').addEventListener('click',done); cleanup.push(()=>root.querySelector('[data-mark-complete]')?.removeEventListener('click',done));
  applyFault(); render();
}

export function unmount(){ cleanup.forEach(fn=>{try{fn()}catch{}}); cleanup=[]; }
