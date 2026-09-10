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
      <div>
        <div class="eyebrow">Connected systems lab</div><h2>Whole-cluster Sandbox v2</h2>
        <p class="hero-copy">Schedule Pods, change resources, cordon or drain nodes, break CNI, drag a Pod into a what-if placement, and watch a Kubernetes-style event stream explain each subsystem boundary.</p>
      </div>
      <div class="chip-row sandbox-presets">
        <button class="chip-btn preset active" data-preset="none">Healthy</button>
        <button class="chip-btn preset" data-preset="pressure">Scheduler pressure</button>
        <button class="chip-btn preset" data-preset="node">Node NotReady</button>
        <button class="chip-btn preset" data-preset="cni">CNI failure</button>
        <button class="chip-btn preset" data-preset="readiness">Readiness failure</button>
        <button class="chip-btn preset" data-preset="drain">Drain node-b</button>
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
          <div class="control"><label>Request <strong id="draft-request-v"></strong></label><input id="draft-request" type="range" min="0.1" max="4" step="0.1" value="0.5"></div>
          <div class="control"><label>Limit <strong id="draft-limit-v"></strong></label><input id="draft-limit" type="range" min="0.1" max="4" step="0.1" value="1"></div>
          <div class="control"><label>Demand <strong id="draft-demand-v"></strong></label><input id="draft-demand" type="range" min="0" max="6" step="0.1" value="0.8"></div>
        </div>
        <div class="chip-row"><button class="primary-btn" id="schedule">Schedule replica</button><button class="chip-btn" id="retry-pending">Retry Pending</button><button class="chip-btn" id="send">Send Service request</button></div>
        <div id="scheduler-preview" class="sandbox-preview"></div>
        <div id="selected-inspector" style="margin-top:14px"></div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:16px">
      <div class="panel">
        <div class="section-head" style="margin:0 0 12px"><div><div class="eyebrow">Node controls</div><h3>Operate the cluster</h3></div></div>
        <div id="node-controls"></div>
      </div>
      <div class="panel">
        <div class="section-head" style="margin:0 0 12px"><div><div class="eyebrow">Service path</div><h3>Ready ≠ always reachable</h3></div></div>
        <div id="service-panel"></div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:16px">
      <div class="panel">
        <div class="section-head" style="margin:0 0 12px"><div><div class="eyebrow">kubectl-style event stream</div><h3>Observe before guessing</h3></div><button class="chip-btn" id="clear-events">Clear</button></div>
        <div id="event-stream" class="event-stream" aria-live="polite"></div>
      </div>
      <div class="panel">
        <div class="eyebrow">Mechanism map</div>
        <div class="flow sandbox-flow" style="grid-template-columns:repeat(4,minmax(130px,1fr))">
          <div class="flow-step active"><strong>API object</strong><small>request / limit / desired replica</small></div>
          <div class="flow-step active"><strong>Scheduler</strong><small>request fit + node eligibility</small></div>
          <div class="flow-step active"><strong>kubelet + CRI/CNI</strong><small>turn assignment into a running Pod</small></div>
          <div class="flow-step active"><strong>Linux cgroup</strong><small>runtime CPU ceiling</small></div>
          <div class="flow-step active"><strong>Readiness</strong><small>traffic eligibility</small></div>
          <div class="flow-step active"><strong>EndpointSlice</strong><small>derived backend set</small></div>
          <div class="flow-step active"><strong>Service</strong><small>select a Ready endpoint</small></div>
          <div class="flow-step active"><strong>Events / metrics</strong><small>evidence for diagnosis</small></div>
        </div>
        <div class="callout warn"><strong>One symptom can cross boundaries.</strong><p>“Requests fail” may be caused by scheduling pressure, a NotReady Pod, a broken node dataplane, or an application slowed by CPU throttling. Follow the evidence path instead of jumping to a component.</p></div>
        <button class="primary-btn" data-mark-complete>Mark sandbox complete</button>
      </div>
    </div>`;

  const $ = selector => root.querySelector(selector);
  const cpu = value => value < 1 ? `${Math.round(value * 1000)}m` : `${Number(value.toFixed(1))} CPU`;

  function selectedPod() { return state.selectedPodId ? podById(state, state.selectedPodId) : null; }

  function renderSummary() {
    const summary = clusterSummary(state);
    $('#summary').innerHTML = `
      <div class="metric"><span>Running Pods</span><strong>${summary.running}</strong></div>
      <div class="metric"><span>Pending</span><strong>${summary.pending}</strong></div>
      <div class="metric"><span>Ready endpoints</span><strong>${summary.ready}</strong></div>
      <div class="metric"><span>Reachable</span><strong>${summary.reachable}</strong></div>
      <div class="metric"><span>CPU throttle risk</span><strong>${summary.throttled}</strong></div>
      <div class="metric"><span>Service failures</span><strong>${summary.serviceFailures}/${summary.serviceRequests}</strong></div>`;
  }

  function podCard(pod) {
    const runtime = runtimeInfo(pod);
    const node = state.nodes.find(item => item.name === pod.node);
    const status = pod.phase === 'Pending' ? 'Pending' : !node?.healthy ? 'NodeNotReady' : !pod.ready ? 'NotReady' : !node?.cni ? 'Ready / net risk' : runtime?.throttled ? 'Ready / throttled' : 'Ready';
    return `<button class="sandbox-pod ${state.selectedPodId === pod.id ? 'selected' : ''} ${pod.phase === 'Pending' ? 'pending' : ''}" draggable="${pod.phase === 'Running'}" data-pod-id="${pod.id}" aria-label="Select ${pod.name}">
      <div class="sandbox-pod-head"><strong>${pod.name}</strong><span>${status}</span></div>
      <div class="sandbox-pod-meta"><span>req ${cpu(pod.request)}</span><span>lim ${cpu(pod.limit)}</span><span>demand ${cpu(pod.demand)}</span></div>
    </button>`;
  }

  function renderCanvas() {
    const runningByNode = new Map(state.nodes.map(node => [node.name, state.pods.filter(pod => pod.node === node.name)]));
    $('#cluster-canvas').innerHTML = `
      ${state.nodes.map(node => {
        const requested = nodeRequested(state, node.name);
        const headroom = nodeHeadroom(state, node.name);
        const status = !node.healthy ? 'NotReady' : node.cordoned ? 'Cordoned' : !node.cni ? 'CNI broken' : 'Ready';
        return `<div class="sandbox-node ${!node.healthy ? 'danger' : node.cordoned ? 'warn' : ''}" data-drop-node="${node.name}">
          <div class="sandbox-node-head"><div><strong>${node.name}</strong><small>${node.zone}</small></div><span class="badge">${status}</span></div>
          <div class="node-row"><span>Requested / allocatable</span><span>${requested.toFixed(1)} / ${node.cpu} CPU</span></div><div class="bar req"><i style="width:${Math.min(100, requested / node.cpu * 100)}%"></i></div>
          <div class="node-row"><span>Scheduler headroom</span><span>${headroom.toFixed(1)} CPU</span></div>
          <div class="sandbox-pods">${runningByNode.get(node.name).map(podCard).join('') || '<div class="sandbox-empty">No workload Pods</div>'}</div>
        </div>`;
      }).join('')}
      <div class="sandbox-node pending-zone"><div class="sandbox-node-head"><div><strong>Pending queue</strong><small>no node binding yet</small></div><span class="badge">${state.pending.length}</span></div><div class="sandbox-pods">${state.pending.map(podCard).join('') || '<div class="sandbox-empty">Empty</div>'}</div></div>`;

    root.querySelectorAll('[data-pod-id]').forEach(card => {
      const select = () => { state.selectedPodId = card.dataset.podId; render(); };
      const dragStart = event => { draggedPodId = card.dataset.podId; event.dataTransfer?.setData('text/plain', draggedPodId); card.classList.add('dragging'); };
      const dragEnd = () => { draggedPodId = null; card.classList.remove('dragging'); };
      card.addEventListener('click', select);
      card.addEventListener('dragstart', dragStart);
      card.addEventListener('dragend', dragEnd);
      cleanup.push(() => card.removeEventListener('click', select), () => card.removeEventListener('dragstart', dragStart), () => card.removeEventListener('dragend', dragEnd));
    });

    root.querySelectorAll('[data-drop-node]').forEach(zone => {
      const over = event => { event.preventDefault(); zone.classList.add('drop-target'); };
      const leave = () => zone.classList.remove('drop-target');
      const drop = event => {
        event.preventDefault(); zone.classList.remove('drop-target');
        const podId = event.dataTransfer?.getData('text/plain') || draggedPodId;
        if (!podId) return;
        const result = movePod(state, podId, zone.dataset.dropNode);
        if (result.ok && awardXP) awardXP('sandbox:what-if-placement', 25);
        render();
      };
      zone.addEventListener('dragover', over); zone.addEventListener('dragleave', leave); zone.addEventListener('drop', drop);
      cleanup.push(() => zone.removeEventListener('dragover', over), () => zone.removeEventListener('dragleave', leave), () => zone.removeEventListener('drop', drop));
    });
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
    $('#selected-inspector').innerHTML = `
      <div class="section-head" style="margin:0 0 10px"><div><div class="eyebrow">Selected Pod</div><h3>${pod.name}</h3></div><span class="badge">${pod.phase}</span></div>
      <div class="grid-3"><div class="metric"><span>Node</span><strong>${pod.node || '—'}</strong></div><div class="metric"><span>Endpoint eligible</span><strong>${eligible ? 'Yes' : 'No'}</strong></div><div class="metric"><span>cpu.max</span><strong>${runtime?.cpuMax || '—'}</strong></div></div>
      <div class="grid-3" style="margin-top:10px">
        <div class="control"><label>Request</label><input id="edit-request" type="number" min="0.05" step="0.05" value="${pod.request}"></div>
        <div class="control"><label>Limit</label><input id="edit-limit" type="number" min="0.05" step="0.05" value="${pod.limit}"></div>
        <div class="control"><label>Demand</label><input id="edit-demand" type="number" min="0" step="0.05" value="${pod.demand}"></div>
      </div>
      <div class="chip-row"><button class="chip-btn" id="apply-pod-edit">Apply resource edit</button><button class="danger-btn" id="delete-pod">Delete Pod</button></div>
      <div class="callout ${runtime?.throttled ? 'danger' : 'success'}"><strong>${runtime?.throttled ? 'CPU throttling risk' : 'Demand within CPU ceiling'}</strong><p>${runtime?.throttled ? `Idealized cgroup model: demand ${cpu(pod.demand)} exceeds limit ${cpu(pod.limit)}. In a 100ms period, quota could be exhausted after roughly ${runtime.theoreticalRunMs.toFixed(1)}ms of full parallel demand.` : `Demand ${cpu(pod.demand)} is within the configured ${cpu(pod.limit)} limit in this model.`}</p></div>`;

    const applyEdit = () => {
      updatePodResources(state, pod.id, { request:Number($('#edit-request').value), limit:Number($('#edit-limit').value), demand:Number($('#edit-demand').value) });
      if (awardXP) awardXP('sandbox:resource-edit', 25);
      render();
    };
    const remove = () => { deletePod(state, pod.id); render(); };
    $('#apply-pod-edit')?.addEventListener('click', applyEdit); $('#delete-pod')?.addEventListener('click', remove);
    cleanup.push(() => $('#apply-pod-edit')?.removeEventListener('click', applyEdit), () => $('#delete-pod')?.removeEventListener('click', remove));
  }

  function renderNodeControls() {
    $('#node-controls').innerHTML = state.nodes.map(node => `<div class="sandbox-node-control"><div><strong>${node.name}</strong><small>${node.zone} · ${node.healthy ? 'Ready' : 'NotReady'} · ${node.cni ? 'CNI OK' : 'CNI broken'} · ${node.cordoned ? 'cordoned' : 'schedulable'}</small></div><div class="chip-row"><button class="chip-btn node-health" data-node="${node.name}">${node.healthy ? 'Make NotReady' : 'Make Ready'}</button><button class="chip-btn node-cni" data-node="${node.name}">${node.cni ? 'Break CNI' : 'Repair CNI'}</button><button class="chip-btn node-cordon" data-node="${node.name}">${node.cordoned ? 'Uncordon' : 'Cordon'}</button><button class="chip-btn node-drain" data-node="${node.name}">Drain</button></div></div>`).join('');

    root.querySelectorAll('.node-health').forEach(button => {
      const handler = () => { const node = state.nodes.find(item => item.name === button.dataset.node); setNodeHealth(state, node.name, !node.healthy); render(); };
      button.addEventListener('click', handler); cleanup.push(() => button.removeEventListener('click', handler));
    });
    root.querySelectorAll('.node-cni').forEach(button => {
      const handler = () => { const node = state.nodes.find(item => item.name === button.dataset.node); setNodeCNI(state, node.name, !node.cni); render(); };
      button.addEventListener('click', handler); cleanup.push(() => button.removeEventListener('click', handler));
    });
    root.querySelectorAll('.node-cordon').forEach(button => {
      const handler = () => { const node = state.nodes.find(item => item.name === button.dataset.node); setNodeCordoned(state, node.name, !node.cordoned); render(); };
      button.addEventListener('click', handler); cleanup.push(() => button.removeEventListener('click', handler));
    });
    root.querySelectorAll('.node-drain').forEach(button => {
      const handler = () => { drainNode(state, button.dataset.node); if (awardXP) awardXP('sandbox:first-drain', 25); render(); };
      button.addEventListener('click', handler); cleanup.push(() => button.removeEventListener('click', handler));
    });
  }

  function renderService() {
    const ready = readyEndpoints(state);
    const reachable = reachableEndpoints(state);
    $('#service-panel').innerHTML = `
      <div class="grid-3"><div class="metric"><span>Ready endpoints</span><strong>${ready.length}</strong></div><div class="metric"><span>Reachable now</span><strong>${reachable.length}</strong></div><div class="metric"><span>Requests failed</span><strong>${state.serviceFailures}/${state.serviceRequests}</strong></div></div>
      <div class="chip-row" style="margin-top:12px">${ready.map(pod => `<span class="badge">${pod.name} @ ${pod.node}${reachable.includes(pod) ? '' : ' ⚠'}</span>`).join('') || '<span class="badge">No Ready endpoints</span>'}</div>
      <div class="callout ${ready.length === reachable.length ? 'success' : 'warn'}"><strong>${ready.length === reachable.length ? 'Endpoint eligibility and network reachability agree' : 'A Ready endpoint can still fail on the network path'}</strong><p>Readiness controls EndpointSlice eligibility. It does not prove every packet path, node dataplane, or downstream dependency is healthy.</p></div>`;
  }

  function renderEvents() {
    $('#event-stream').innerHTML = state.events.length ? state.events.map(event => `<div class="event-row ${event.type.toLowerCase()}"><span>${event.at}</span><strong>${event.type}</strong><code>${event.reason}</code><span>${event.object}</span><p>${event.message}</p></div>`).join('') : '<div class="sandbox-empty">No events yet.</div>';
  }

  function renderDraft() {
    $('#draft-request-v').textContent = cpu(draft.request);
    $('#draft-limit-v').textContent = cpu(draft.limit);
    $('#draft-demand-v').textContent = cpu(draft.demand);
  }

  function render() {
    renderDraft(); renderSummary(); renderCanvas(); renderSchedulerPreview(); renderSelectedInspector(); renderNodeControls(); renderService(); renderEvents();
  }

  function changeDraft(event) {
    draft[event.target.dataset.key] = Number(event.target.value);
    renderDraft(); renderSchedulerPreview();
  }
  ['request','limit','demand'].forEach(key => {
    const input = $(`#draft-${key}`); input.dataset.key = key; input.addEventListener('input', changeDraft); cleanup.push(() => input.removeEventListener('input', changeDraft));
  });

  function schedule() { const result = scheduleReplica(state, draft); if (result.ok && awardXP) awardXP('sandbox:first-schedule', 25); render(); }
  function retry() { const count = reschedulePending(state); if (count && awardXP) awardXP('sandbox:retry-pending', 25); render(); }
  function send() { const result = sendServiceRequest(state); if (result.ok && awardXP) awardXP('sandbox:first-service-request', 25); render(); }
  function clearEvents() { state.events = []; renderEvents(); }
  function preset(event) { applyPreset(state, event.currentTarget.dataset.preset); root.querySelectorAll('.preset').forEach(button => button.classList.toggle('active', button === event.currentTarget)); render(); }
  function done() { markComplete(); }

  $('#schedule').addEventListener('click', schedule); $('#retry-pending').addEventListener('click', retry); $('#send').addEventListener('click', send); $('#clear-events').addEventListener('click', clearEvents);
  cleanup.push(() => $('#schedule')?.removeEventListener('click', schedule), () => $('#retry-pending')?.removeEventListener('click', retry), () => $('#send')?.removeEventListener('click', send), () => $('#clear-events')?.removeEventListener('click', clearEvents));
  root.querySelectorAll('.preset').forEach(button => { button.addEventListener('click', preset); cleanup.push(() => button.removeEventListener('click', preset)); });
  root.querySelector('[data-mark-complete]').addEventListener('click', done); cleanup.push(() => root.querySelector('[data-mark-complete]')?.removeEventListener('click', done));
  render();
}

export function unmount() { cleanup.forEach(fn => { try { fn(); } catch {} }); cleanup = []; }
