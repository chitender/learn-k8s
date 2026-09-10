const baseNodes = () => [
  { name:'node-a', zone:'zone-a', cpu:8, baseRequested:4.5, live:2.2, healthy:true, cni:true, cordoned:false },
  { name:'node-b', zone:'zone-b', cpu:8, baseRequested:5.5, live:1.4, healthy:true, cni:true, cordoned:false },
  { name:'node-c', zone:'zone-a', cpu:4, baseRequested:1.5, live:0.8, healthy:true, cni:true, cordoned:false }
];

const basePods = () => [
  { id:'web-1', name:'web-7d9-a', node:'node-a', request:0.5, limit:1, demand:0.45, phase:'Running', ready:true },
  { id:'web-2', name:'web-7d9-b', node:'node-a', request:0.5, limit:1, demand:0.70, phase:'Running', ready:true },
  { id:'web-3', name:'web-7d9-c', node:'node-b', request:0.5, limit:1, demand:0.55, phase:'Running', ready:true },
  { id:'web-4', name:'web-7d9-d', node:'node-c', request:0.5, limit:1, demand:0.35, phase:'Running', ready:true }
];

function nowStep(state) {
  state.clock += 1;
  return `t+${state.clock}s`;
}

export function addEvent(state, type, reason, message, object = 'cluster') {
  state.eventSeq += 1;
  state.events.unshift({ id:state.eventSeq, at:nowStep(state), type, reason, message, object });
  state.events = state.events.slice(0, 80);
}

export function createClusterState() {
  const state = {
    nodes: baseNodes(),
    pods: basePods(),
    pending: [],
    events: [],
    eventSeq: 0,
    clock: 0,
    requestSeq: 0,
    nextPod: 5,
    serviceRequests: 0,
    serviceFailures: 0,
    selectedPodId: 'web-1',
    fault: 'none'
  };
  addEvent(state, 'Normal', 'SimulatorReady', 'Healthy three-node cluster created.', 'cluster');
  return state;
}

export function nodeByName(state, name) {
  return state.nodes.find(node => node.name === name) || null;
}

export function podById(state, id) {
  return state.pods.find(pod => pod.id === id) || state.pending.find(pod => pod.id === id) || null;
}

export function podRequestedOnNode(state, nodeName, excludingPodId = null) {
  return state.pods.filter(pod => pod.node === nodeName && pod.id !== excludingPodId && pod.phase === 'Running').reduce((sum, pod) => sum + pod.request, 0);
}

export function nodeRequested(state, nodeName, excludingPodId = null) {
  const node = nodeByName(state, nodeName);
  if (!node) return 0;
  return node.baseRequested + podRequestedOnNode(state, nodeName, excludingPodId);
}

export function nodeHeadroom(state, nodeName, excludingPodId = null) {
  const node = nodeByName(state, nodeName);
  return node ? Math.max(0, node.cpu - nodeRequested(state, nodeName, excludingPodId)) : 0;
}

export function schedulerCandidates(state, spec, excludingPodId = null) {
  return state.nodes.map(node => {
    const reasons = [];
    if (!node.healthy) reasons.push('NodeNotReady');
    if (node.cordoned) reasons.push('Unschedulable');
    const headroom = nodeHeadroom(state, node.name, excludingPodId);
    if (headroom < spec.request) reasons.push('Insufficient cpu');
    return { node, headroom, feasible:reasons.length === 0, reasons };
  });
}

function bestCandidate(candidates) {
  return candidates.filter(item => item.feasible).sort((a,b) => b.headroom - a.headroom || a.node.name.localeCompare(b.node.name))[0] || null;
}

function newPod(state, spec) {
  const number = state.nextPod++;
  return {
    id:`web-${number}`,
    name:`web-new-${number}`,
    node:null,
    request:spec.request,
    limit:spec.limit,
    demand:spec.demand,
    phase:'Pending',
    ready:false
  };
}

export function scheduleReplica(state, spec) {
  const pod = newPod(state, spec);
  const candidates = schedulerCandidates(state, pod);
  const choice = bestCandidate(candidates);
  if (!choice) {
    state.pending.push(pod);
    state.selectedPodId = pod.id;
    const detail = candidates.map(item => `${item.node.name}: ${item.reasons.join(', ') || 'feasible'}`).join('; ');
    addEvent(state, 'Warning', 'FailedScheduling', `No feasible node for ${pod.name}. ${detail}`, `pod/${pod.name}`);
    return { ok:false, pod, candidates };
  }
  pod.node = choice.node.name;
  pod.phase = 'Running';
  pod.ready = choice.node.cni;
  state.pods.push(pod);
  state.selectedPodId = pod.id;
  addEvent(state, 'Normal', 'Scheduled', `Assigned ${pod.name} to ${choice.node.name} using request=${pod.request} CPU.`, `pod/${pod.name}`);
  addEvent(state, 'Normal', 'Pulled', `Image available for ${pod.name}; container runtime can start the workload.`, `pod/${pod.name}`);
  if (pod.ready) addEvent(state, 'Normal', 'Ready', `${pod.name} became Ready and is eligible for Service endpoints.`, `pod/${pod.name}`);
  else addEvent(state, 'Warning', 'NetworkUnavailable', `${pod.name} started but node networking is unhealthy, so it is not Ready in this simulation.`, `pod/${pod.name}`);
  return { ok:true, pod, candidate:choice, candidates };
}

export function reschedulePending(state) {
  const stillPending = [];
  let scheduled = 0;
  for (const pod of state.pending) {
    const candidates = schedulerCandidates(state, pod);
    const choice = bestCandidate(candidates);
    if (!choice) { stillPending.push(pod); continue; }
    pod.node = choice.node.name;
    pod.phase = 'Running';
    pod.ready = choice.node.cni;
    state.pods.push(pod);
    scheduled++;
    addEvent(state, 'Normal', 'Scheduled', `Pending ${pod.name} now fits on ${choice.node.name}.`, `pod/${pod.name}`);
  }
  state.pending = stillPending;
  return scheduled;
}

export function movePod(state, podId, targetNodeName) {
  const pod = state.pods.find(item => item.id === podId);
  const target = nodeByName(state, targetNodeName);
  if (!pod || !target) return { ok:false, reason:'Pod or node not found' };
  if (pod.node === targetNodeName) return { ok:true, noChange:true };
  const candidate = schedulerCandidates(state, pod, pod.id).find(item => item.node.name === targetNodeName);
  if (!candidate?.feasible) {
    addEvent(state, 'Warning', 'WhatIfPlacementRejected', `${pod.name} would not fit on ${targetNodeName}: ${(candidate?.reasons || ['unknown']).join(', ')}.`, `pod/${pod.name}`);
    return { ok:false, reason:(candidate?.reasons || ['unknown']).join(', ') };
  }
  const from = pod.node;
  pod.node = targetNodeName;
  pod.ready = target.healthy && target.cni;
  addEvent(state, 'Normal', 'WhatIfPlacement', `Moved ${pod.name} from ${from} to ${targetNodeName} for this teaching simulation.`, `pod/${pod.name}`);
  return { ok:true };
}

export function updatePodResources(state, podId, next) {
  const pod = podById(state, podId);
  if (!pod) return;
  const oldRequest = pod.request;
  pod.request = Math.max(0.05, Number(next.request ?? pod.request));
  pod.limit = Math.max(0.05, Number(next.limit ?? pod.limit));
  pod.demand = Math.max(0, Number(next.demand ?? pod.demand));
  addEvent(state, 'Normal', 'ResourceChanged', `${pod.name}: request ${oldRequest}→${pod.request} CPU, limit=${pod.limit}, demand=${pod.demand}.`, `pod/${pod.name}`);
  if (pod.node && nodeRequested(state, pod.node) > nodeByName(state, pod.node).cpu) {
    addEvent(state, 'Warning', 'OvercommittedAfterEdit', `${pod.node} is now over its simulated scheduler request capacity. Existing Pods are not retroactively evicted by the scheduler.`, `node/${pod.node}`);
  }
}

export function deletePod(state, podId) {
  const runningIndex = state.pods.findIndex(pod => pod.id === podId);
  if (runningIndex >= 0) {
    const [pod] = state.pods.splice(runningIndex, 1);
    addEvent(state, 'Normal', 'Deleted', `${pod.name} deleted from the simulation.`, `pod/${pod.name}`);
    state.selectedPodId = state.pods[0]?.id || state.pending[0]?.id || null;
    return true;
  }
  const pendingIndex = state.pending.findIndex(pod => pod.id === podId);
  if (pendingIndex >= 0) {
    const [pod] = state.pending.splice(pendingIndex, 1);
    addEvent(state, 'Normal', 'Deleted', `Pending ${pod.name} deleted from the simulation.`, `pod/${pod.name}`);
    state.selectedPodId = state.pods[0]?.id || state.pending[0]?.id || null;
    return true;
  }
  return false;
}

export function runtimeInfo(pod) {
  if (!pod) return null;
  const throttled = pod.demand > pod.limit;
  const quota = Math.round(pod.limit * 100000);
  const runFraction = pod.demand > 0 ? Math.min(1, pod.limit / pod.demand) : 1;
  return {
    throttled,
    quota,
    period:100000,
    cpuMax:`${quota} 100000`,
    theoreticalRunMs:100 * runFraction,
    theoreticalThrottleMs:100 * (1 - runFraction)
  };
}

export function readyEndpoints(state) {
  return state.pods.filter(pod => {
    const node = nodeByName(state, pod.node);
    return pod.phase === 'Running' && pod.ready && node?.healthy;
  });
}

export function reachableEndpoints(state) {
  return readyEndpoints(state).filter(pod => nodeByName(state, pod.node)?.cni);
}

export function sendServiceRequest(state) {
  state.serviceRequests++;
  const endpoints = readyEndpoints(state);
  if (!endpoints.length) {
    state.serviceFailures++;
    addEvent(state, 'Warning', 'ServiceUnavailable', 'Service has no Ready endpoints.', 'service/web');
    return { ok:false, reason:'No Ready endpoints' };
  }
  const index = (state.requestSeq++) % endpoints.length;
  const target = endpoints[index];
  const node = nodeByName(state, target.node);
  if (!node?.cni) {
    state.serviceFailures++;
    addEvent(state, 'Warning', 'NetworkTimeout', `Request selected ${target.name}, but ${node?.name || 'node'} networking is unhealthy.`, 'service/web');
    return { ok:false, pod:target, reason:'CNI/dataplane failure' };
  }
  const runtime = runtimeInfo(target);
  const latency = runtime.throttled ? 'high latency risk from CPU throttling' : 'normal runtime path';
  addEvent(state, 'Normal', 'ServiceRequest', `Request routed to ${target.name} on ${target.node}; ${latency}.`, 'service/web');
  return { ok:true, pod:target, throttled:runtime.throttled };
}

export function setNodeHealth(state, nodeName, healthy) {
  const node = nodeByName(state, nodeName);
  if (!node) return;
  node.healthy = healthy;
  if (!healthy) {
    state.pods.filter(pod => pod.node === nodeName).forEach(pod => { pod.ready = false; });
    addEvent(state, 'Warning', 'NodeNotReady', `${nodeName} became NotReady; Pods on the node are removed from Ready endpoint calculations in this simulation.`, `node/${nodeName}`);
  } else {
    state.pods.filter(pod => pod.node === nodeName).forEach(pod => { pod.ready = node.cni; });
    addEvent(state, 'Normal', 'NodeReady', `${nodeName} is Ready again.`, `node/${nodeName}`);
  }
}

export function setNodeCNI(state, nodeName, healthy) {
  const node = nodeByName(state, nodeName);
  if (!node) return;
  node.cni = healthy;
  addEvent(state, healthy ? 'Normal' : 'Warning', healthy ? 'NetworkReady' : 'NetworkUnavailable', `${nodeName} CNI/dataplane is ${healthy ? 'healthy' : 'broken'}.`, `node/${nodeName}`);
}

export function setNodeCordoned(state, nodeName, cordoned) {
  const node = nodeByName(state, nodeName);
  if (!node) return;
  node.cordoned = cordoned;
  addEvent(state, 'Normal', cordoned ? 'Cordon' : 'Uncordon', `${nodeName} is ${cordoned ? 'unschedulable for new Pods' : 'schedulable again'}.`, `node/${nodeName}`);
}

export function drainNode(state, nodeName) {
  const node = nodeByName(state, nodeName);
  if (!node) return { evicted:0, pending:0 };
  node.cordoned = true;
  const victims = state.pods.filter(pod => pod.node === nodeName);
  state.pods = state.pods.filter(pod => pod.node !== nodeName);
  let scheduled = 0;
  let pending = 0;
  for (const pod of victims) {
    pod.node = null;
    pod.phase = 'Pending';
    pod.ready = false;
    const choice = bestCandidate(schedulerCandidates(state, pod));
    if (choice) {
      pod.node = choice.node.name;
      pod.phase = 'Running';
      pod.ready = choice.node.cni && choice.node.healthy;
      state.pods.push(pod);
      scheduled++;
      addEvent(state, 'Normal', 'Scheduled', `Evicted ${pod.name} rescheduled to ${choice.node.name}.`, `pod/${pod.name}`);
    } else {
      state.pending.push(pod);
      pending++;
      addEvent(state, 'Warning', 'FailedScheduling', `Evicted ${pod.name} cannot fit after draining ${nodeName}.`, `pod/${pod.name}`);
    }
  }
  addEvent(state, 'Normal', 'Drain', `${nodeName} cordoned; ${victims.length} Pod(s) evicted, ${scheduled} rescheduled, ${pending} pending.`, `node/${nodeName}`);
  state.selectedPodId = state.pods[0]?.id || state.pending[0]?.id || null;
  return { evicted:victims.length, pending };
}

export function applyPreset(state, preset) {
  const fresh = createClusterState();
  Object.assign(state, fresh);
  state.fault = preset;
  if (preset === 'node') setNodeHealth(state, 'node-b', false);
  if (preset === 'cni') setNodeCNI(state, 'node-b', false);
  if (preset === 'readiness') {
    state.pods.slice(0, 2).forEach(pod => { pod.ready = false; });
    addEvent(state, 'Warning', 'Unhealthy', 'Two Pods failed readiness and were removed from Service endpoint eligibility.', 'deployment/web');
  }
  if (preset === 'pressure') {
    state.nodes.forEach(node => { node.baseRequested = Math.max(0, node.cpu - podRequestedOnNode(state, node.name) - 0.25); });
    addEvent(state, 'Warning', 'CapacityPressure', 'Existing requests leave only 250m scheduler headroom per node.', 'cluster');
  }
  if (preset === 'drain') drainNode(state, 'node-b');
  return state;
}

export function clusterSummary(state) {
  const endpoints = readyEndpoints(state);
  const reachable = reachableEndpoints(state);
  const throttled = state.pods.filter(pod => runtimeInfo(pod).throttled).length;
  return {
    running:state.pods.length,
    pending:state.pending.length,
    ready:endpoints.length,
    reachable:reachable.length,
    throttled,
    serviceRequests:state.serviceRequests,
    serviceFailures:state.serviceFailures
  };
}
