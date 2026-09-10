import {
  createClusterState,
  nodeRequested,
  nodeHeadroom,
  schedulerCandidates,
  scheduleReplica,
  reschedulePending,
  movePod,
  updatePodResources,
  deletePod,
  runtimeInfo,
  readyEndpoints,
  reachableEndpoints,
  sendServiceRequest,
  setNodeHealth,
  setNodeCNI,
  setNodeCordoned,
  drainNode,
  applyPreset,
  clusterSummary,
  podById
} from '../sim/cluster-engine.js';

let cleanup = [];

export function mount(root, { markComplete, awardXP }) {
  const state = createClusterState();
  const draft = { request:0.5, limit:1, demand:0.8 };
  let draggedPodId = null;

  root.innerHTML = `
    <div class="panel sandbox-hero">
      <div><div class="eyebrow">Connected systems lab</div><h2>Whole-cluster Sandbox v2</h2><p class="hero-copy">Schedule Pods, change resources, cordon or drain nodes, break CNI, drag a Pod into a what-if placement, and watch a Kubernetes-style event stream explain each subsystem boundary.</p></div>
      <div class="chip-row sandbox-presets">
        <button class="chip-btn preset active" data-preset="none">Healthy</button><button class="chip-btn preset" data-preset="pressure">Scheduler pressure</button><button class="chip-btn preset" data-preset="node">Node NotReady</button><button class="chip-btn preset" data-preset="cni">CNI failure</button><button class="chip-btn preset" data-preset="readiness">Readiness failure</button><button class="chip-btn preset" data-preset="drain">Drain node-b</button>
      </div>
    </div>

    <div class="sandbox-summary" id="summary"></div>

    <div class="grid-2 sandbox-main" style="margin-top:16px">
      <div class="panel">
        <div class="section-head" style="margin:0 0 12px"><div><div class="eyebrow">Cluster canvas</div><h3>Nodes + Pods</h3></div><span class="badge">Drag = what-if placement</span></div>
        <div id="cluster-canvas" class="cluster-canvas"></div>
        <div class="callout"><strong>Dragging is a teaching tool, not a Kubernetes operation.</strong><p>Dropping a Pod on a node asks “would this placement be feasible?” The simulator rejects moves that violate node health, cordon state, or CPU request fit.</p></div>
      </div>

      <div class="panel">
        <div class="eyebrow">Create / inspect workload</div>
        <div class="grid-3" style="margin-top:12px">
          <div class="control"><label>Request <strong id="draft-request-v"></strong></label><input id="draft-request" data-draft="request" type="range" min="0.1" max="4" step="0.1" value="0.5"></div>
          <div class="control"><label>Limit <strong id="draft-limit-v"></strong></label><input id="draft-limit" data-draft="limit" type="range" min="0.1" max="4" step="0.1" value="1"></div>
          <div class="control"><label>Demand <strong id="draft-demand-v"></strong></label><input id="draft-demand" data-draft="demand" type="range" min="0" max="6" step="0.1" value="0.8"></div>
        </div>
        <div class="chip-row"><button class="primary-btn" data-action="schedule">Schedule replica</button><button class="chip-btn" data-action="retry-pending">Retry Pending</button><button class="chip-btn" data-action="send">Send Service request</button></div>
        <div id="scheduler-preview" class="sandbox-preview"></div>
        <div id="selected-inspector" style="margin-top:14px"></div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:16px">
      <div class="panel"><div class="section-head" style="margin:0 0 12px"><div><div class="eyebrow">Node controls</div><h3>Operate the cluster</h3></div></div><div id="node-controls"></div></div>
      <div class="panel"><div class="section-head" style="margin:0 0 12px"><div><div class="eyebrow">Service path</div><h3>Ready ≠ always reachable</h3></div></div><div id="service-panel"></div></div>
    </div>

    <div class="grid-2" style="margin-top:16px">
      <div class="panel"><div class="section-head" style="margin:0 0 12px"><div><div class="eyebrow">kubectl-style event stream</div><h3>Observe before guessing</h3></div><button class="chip-btn" data-action="clear-events">Clear</button></div><div id="event-stream" class="event-stream" aria-live="polite"></div></div>
      <div class="panel">
        <div class="eyebrow">Mechanism map</div>
        <div class="flow sandbox-flow" style="grid-template-columns:repeat(4,minmax(130px,1fr))">
          <div class="flow-step active"><strong>API object</strong><small>request / limit / desired replica</small></div><div class="flow-step active"><strong>Scheduler</strong><small>request fit + node eligibility</small></div><div class="flow-step active"><strong>kubelet + CRI/CNI</strong><small>turn assignment into a running Pod</small></div><div class="flow-step active"><strong>Linux cgroup</strong><small>runtime CPU ceiling</small></div><div class="flow-step active"><strong>Readiness</strong><small>traffic eligibility</small></div><div class="flow-step active"><strong>EndpointSlice</strong><small>derived backend set</small></div><div class="flow-step active"><strong>Service</strong><small>select a Ready endpoint</small></div><div class="flow-step active"><strong>Events / metrics</strong><small>evidence for diagnosis</small></div>
        </div>
        <div class="callout warn"><strong>One symptom can cross boundaries.</strong><p>“Requests fail” may be caused by scheduling pressure, a NotReady Pod, a broken node dataplane, or an application slowed by CPU throttling. Follow the evidence path instead of jumping to a component.</p></div>
        <button class="primary-btn" data-mark-complete>Mark sandbox complete</button>
      </div>
    </div>`;

  const $ = selector => root.querySelector(selector);
  const cpu = value => value < 1 ? `${Math.round(value * 1000)}m` : `${Number(value.toFixed(1))} CPU`;
  const selectedPod = () => state.selectedPodId ? podById(state, state.selectedPodId) : null;

  function renderSummary() {
    const summary = clusterSummary(state);
    $('#summary').innerHTML = `<div class="metric"><span>Running Pods</span><strong>${summary.running}</strong></div><div class="metric"><span>Pending</span><strong>${summary.pending}</strong></div><div class="metric"><span>Ready endpoints</span><strong>${summary.ready}</strong></div><div class="metric"><span>Reachable</span><strong>${summary.reachable}</strong></div><div class="metric"><span>CPU throttle risk</span><strong>${summary.throttled}</strong></div><div class="metric"><span>Service failures</span><strong>${summary.serviceFailures}/${summary.serviceRequests}</strong></div>`;
  }

  function podCard(pod) {
    const runtime = runtimeInfo(pod);
    const node = state.nodes.find(item => item.name === pod.node);
    const status = pod.phase === 'Pending' ? 'Pending' : !node?.healthy ? 'NodeNotReady' : !pod.ready ? 'NotReady' : !node?.cni ? 'Ready / net risk' : runtime?.throttled ? 'Ready / throttled' : 'Ready';
    return `<button class="sandbox-pod ${state.selectedPodId === pod.id ? 'selected' : ''} ${pod.phase === 'Pending' ? 'pending' : ''}" draggable="${pod.phase === 'Running'}" data-pod-id="${pod.id}" aria-label="Select ${pod.name}"><div class="sandbox-pod-head"><strong>${pod.name}</strong><span>${status}</span></div><div class="sandbox-pod-meta"><span>req ${cpu(pod.request)}</span><span>lim ${cpu(pod.limit)}</span><span>demand ${cpu(pod.demand)}</span></div></button>`;
  }

  function renderCanvas() {
    $('#cluster-canvas').innerHTML = `${state.nodes.map(node => {
      const requested = nodeRequested(state, node.name);
      const headroom = nodeHeadroom(state, node.name);
      const status = !node.healthy ? 'NotReady' : node.cordoned ? 'Cordoned' : !node.cni ? 'CNI broken' : 'Ready';
      const pods = state.pods.filter(pod => pod.node === node.name);
      return `<div class="sandbox-node ${!node.healthy ? 'danger' : node.cordoned ? 'warn' : ''}" data-drop-node="${node.name}"><div class="sandbox-node-head"><div><strong>${node.name}</strong><small>${node.zone}</small></div><span class="badge">${status}</span></div><div class="node-row"><span>Requested / allocatable</span><span>${requested.toFixed(1)} / ${node.cpu} CPU</span></div><div class="bar req"><i style="width:${Math.min(100, requested / node.cpu * 100)}%"></i></div><div class="node-row"><span>Scheduler headroom</span><span>${headroom.toFixed(1)} CPU</span></div><div class="sandbox-pods">${pods.map(podCard).join('') || '<div class="sandbox-empty">No workload Pods</div>'}</div></div>`;
    }).join('')}<div class="sandbox-node pending-zone"><div class="sandbox-node-head"><div><strong>Pending queue</strong><small>no node binding yet</small></div><span class="badge">${state.pending.length}</span></div><div class="sandbox-pods">${state.pending.map(podCard).join('') || '<div class="sandbox-empty">Empty</div>'}</div></div>`;
  }

  function renderSchedulerPreview() {
    const candidates = schedulerCandidates(state, draft);
    $('#scheduler-preview').innerHTML = `<div class="eyebrow" style="margin-top:14px">Scheduler preview</div><div class="candidate-grid">${candidates.map(item => `<div class="candidate ${item.feasible ? 'ok' : 'no'}"><strong>${item.node.name}</strong><span>${item.feasible ? `${item.headroom.toFixed(1)} CPU headroom` : item.reasons.join(' · ')}</span></div>`).join('')}</div>`;
  }

  function renderSelectedInspector() {
    const pod = selectedPod();
    if (!pod) { $('#selected-inspector').innerHTML = '<div class="callout">Select a Pod to inspect it.</div>'; return; }
    const runtime = runtimeInfo(pod);
    const node = pod.node ? state.nodes.find(item => item.name === pod.node) : null;
    const eligible = pod.phase === 'Running' && pod.ready && node?.healthy;
    $('#selected-inspector').innerHTML = `<div class="section-head" style="margin:0 0 10px"><div><div class="eyebrow">Selected Pod</div><h3>${pod.name}</h3></div><span class="badge">${pod.phase}</span></div><div class="grid-3"><div class="metric"><span>Node</span><strong>${pod.node || '—'}</strong></div><div class="metric"><span>Endpoint eligible</span><strong>${eligible ? 'Yes' : 'No'}</strong></div><div class="metric"><span>cpu.max</span><strong>${runtime?.cpuMax || '—'}</strong></div></div><div class="grid-3" style="margin-top:10px"><div class="control"><label>Request</label><input id="edit-request" type="number" min="0.05" step="0.05" value="${pod.request}"></div><div class="control"><label>Limit</label><input id="edit-limit" type="number" min="0.05" step="0.05" value="${pod.limit}"></div><div class="control"><label>Demand</label><input id="edit-demand" type="number" min="0" step="0.05" value="${pod.demand}"></div></div><div class="chip-row"><button class="chip-btn" data-action="apply-pod-edit">Apply resource edit</button><button class="danger-btn" data-action="delete-pod">Delete Pod</button></div><div class="callout ${runtime?.throttled ? 'danger' : 'success'}"><strong>${runtime?.throttled ? 'CPU throttling risk' : 'Demand within CPU ceiling'}</strong><p>${runtime?.throttled ? `Idealized cgroup model: demand ${cpu(pod.demand)} exceeds limit ${cpu(pod.limit)}. In a 100ms period, quota could be exhausted after roughly ${runtime.theoreticalRunMs.toFixed(1)}ms of full parallel demand.` : `Demand ${cpu(pod.demand)} is within the configured ${cpu(pod.limit)} limit in this model.`}</p></div>`;
  }

  function renderNodeControls() {
    $('#node-controls').innerHTML = state.nodes.map(node => `<div class="sandbox-node-control"><div><strong>${node.name}</strong><small>${node.zone} · ${node.healthy ? 'Ready' : 'NotReady'} · ${node.cni ? 'CNI OK' : 'CNI broken'} · ${node.cordoned ? 'cordoned' : 'schedulable'}</small></div><div class="chip-row"><button class="chip-btn" data-node-action="health" data-node="${node.name}">${node.healthy ? 'Make NotReady' : 'Make Ready'}</button><button class="chip-btn" data-node-action="cni" data-node="${node.name}">${node.cni ? 'Break CNI' : 'Repair CNI'}</button><button class="chip-btn" data-node-action="cordon" data-node="${node.name}">${node.cordoned ? 'Uncordon' : 'Cordon'}</button><button class="chip-btn" data-node-action="drain" data-node="${node.name}">Drain</button></div></div>`).join('');
  }

  function renderService() {
    const ready = readyEndpoints(state);
    const reachable = reachableEndpoints(state);
    $('#service-panel').innerHTML = `<div class="grid-3"><div class="metric"><span>Ready endpoints</span><strong>${ready.length}</strong></div><div class="metric"><span>Reachable now</span><strong>${reachable.length}</strong></div><div class="metric"><span>Requests failed</span><strong>${state.serviceFailures}/${state.serviceRequests}</strong></div></div><div class="chip-row" style="margin-top:12px">${ready.map(pod => `<span class="badge">${pod.name} @ ${pod.node}${reachable.includes(pod) ? '' : ' ⚠'}</span>`).join('') || '<span class="badge">No Ready endpoints</span>'}</div><div class="callout ${ready.length === reachable.length ? 'success' : 'warn'}"><strong>${ready.length === reachable.length ? 'Endpoint eligibility and network reachability agree' : 'A Ready endpoint can still fail on the network path'}</strong><p>Readiness controls EndpointSlice eligibility. It does not prove every packet path, node dataplane, or downstream dependency is healthy.</p></div>`;
  }

  function renderEvents() {
    $('#event-stream').innerHTML = state.events.length ? state.events.map(event => `<div class="event-row ${event.type.toLowerCase()}"><span>${event.at}</span><strong>${event.type}</strong><code>${event.reason}</code><span>${event.object}</span><p>${event.message}</p></div>`).join('') : '<div class="sandbox-empty">No events yet.</div>';
  }

  function renderDraft() {
    $('#draft-request-v').textContent = cpu(draft.request); $('#draft-limit-v').textContent = cpu(draft.limit); $('#draft-demand-v').textContent = cpu(draft.demand);
  }

  function render() { renderDraft(); renderSummary(); renderCanvas(); renderSchedulerPreview(); renderSelectedInspector(); renderNodeControls(); renderService(); renderEvents(); }

  function handleInput(event) {
    const key = event.target.dataset.draft;
    if (!key) return;
    draft[key] = Number(event.target.value);
    renderDraft(); renderSchedulerPreview();
  }

  function handleClick(event) {
    const podCardElement = event.target.closest('[data-pod-id]');
    if (podCardElement && root.contains(podCardElement)) { state.selectedPodId = podCardElement.dataset.podId; render(); return; }

    const preset = event.target.closest('[data-preset]');
    if (preset && root.contains(preset)) {
      applyPreset(state, preset.dataset.preset);
      root.querySelectorAll('[data-preset]').forEach(button => button.classList.toggle('active', button === preset));
      render(); return;
    }

    const nodeAction = event.target.closest('[data-node-action]');
    if (nodeAction && root.contains(nodeAction)) {
      const node = state.nodes.find(item => item.name === nodeAction.dataset.node);
      if (!node) return;
      if (nodeAction.dataset.nodeAction === 'health') setNodeHealth(state, node.name, !node.healthy);
      if (nodeAction.dataset.nodeAction === 'cni') setNodeCNI(state, node.name, !node.cni);
      if (nodeAction.dataset.nodeAction === 'cordon') setNodeCordoned(state, node.name, !node.cordoned);
      if (nodeAction.dataset.nodeAction === 'drain') { drainNode(state, node.name); awardXP?.('sandbox:first-drain', 25); }
      render(); return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) {
      if (event.target.closest('[data-mark-complete]')) markComplete();
      return;
    }
    if (action === 'schedule') { const result = scheduleReplica(state, draft); if (result.ok) awardXP?.('sandbox:first-schedule', 25); }
    if (action === 'retry-pending') { const count = reschedulePending(state); if (count) awardXP?.('sandbox:retry-pending', 25); }
    if (action === 'send') { const result = sendServiceRequest(state); if (result.ok) awardXP?.('sandbox:first-service-request', 25); }
    if (action === 'clear-events') state.events = [];
    if (action === 'apply-pod-edit') {
      const pod = selectedPod();
      if (pod) {
        updatePodResources(state, pod.id, { request:Number($('#edit-request').value), limit:Number($('#edit-limit').value), demand:Number($('#edit-demand').value) });
        awardXP?.('sandbox:resource-edit', 25);
      }
    }
    if (action === 'delete-pod') { const pod = selectedPod(); if (pod) deletePod(state, pod.id); }
    render();
  }

  function handleDragStart(event) {
    const card = event.target.closest('[data-pod-id]');
    if (!card || card.getAttribute('draggable') !== 'true') return;
    draggedPodId = card.dataset.podId;
    event.dataTransfer?.setData('text/plain', draggedPodId);
    card.classList.add('dragging');
  }
  function handleDragEnd(event) { event.target.closest('[data-pod-id]')?.classList.remove('dragging'); draggedPodId = null; root.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target')); }
  function handleDragOver(event) { const zone = event.target.closest('[data-drop-node]'); if (!zone) return; event.preventDefault(); root.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target')); zone.classList.add('drop-target'); }
  function handleDrop(event) {
    const zone = event.target.closest('[data-drop-node]');
    if (!zone) return;
    event.preventDefault();
    const podId = event.dataTransfer?.getData('text/plain') || draggedPodId;
    if (podId) { const result = movePod(state, podId, zone.dataset.dropNode); if (result.ok && !result.noChange) awardXP?.('sandbox:what-if-placement', 25); }
    draggedPodId = null; render();
  }

  root.addEventListener('input', handleInput); root.addEventListener('click', handleClick); root.addEventListener('dragstart', handleDragStart); root.addEventListener('dragend', handleDragEnd); root.addEventListener('dragover', handleDragOver); root.addEventListener('drop', handleDrop);
  cleanup.push(() => root.removeEventListener('input', handleInput), () => root.removeEventListener('click', handleClick), () => root.removeEventListener('dragstart', handleDragStart), () => root.removeEventListener('dragend', handleDragEnd), () => root.removeEventListener('dragover', handleDragOver), () => root.removeEventListener('drop', handleDrop));
  render();
}

export function unmount() { cleanup.forEach(fn => { try { fn(); } catch {} }); cleanup = []; }
