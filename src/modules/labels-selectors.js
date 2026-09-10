let cleanup = [];

function parseSelector(raw) {
  const text = raw.trim();
  if (!text) return [];
  const parts = [];
  let current = '';
  let depth = 0;
  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) { parts.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.map(part => {
    let match;
    if ((match = part.match(/^!([A-Za-z0-9_.\/-]+)$/))) return { type:'not-exists', key:match[1] };
    if ((match = part.match(/^([A-Za-z0-9_.\/-]+)\s+notin\s*\(([^)]*)\)$/i))) return { type:'notin', key:match[1], values:match[2].split(',').map(v => v.trim()).filter(Boolean) };
    if ((match = part.match(/^([A-Za-z0-9_.\/-]+)\s+in\s*\(([^)]*)\)$/i))) return { type:'in', key:match[1], values:match[2].split(',').map(v => v.trim()).filter(Boolean) };
    if ((match = part.match(/^([A-Za-z0-9_.\/-]+)!=(.+)$/))) return { type:'neq', key:match[1], value:match[2].trim() };
    if ((match = part.match(/^([A-Za-z0-9_.\/-]+)={1,2}(.+)$/))) return { type:'eq', key:match[1], value:match[2].trim() };
    if ((match = part.match(/^([A-Za-z0-9_.\/-]+)$/))) return { type:'exists', key:match[1] };
    throw new Error(`Unsupported selector fragment: ${part}`);
  });
}

function matches(labels, requirements) {
  return requirements.every(rule => {
    const has = Object.prototype.hasOwnProperty.call(labels, rule.key);
    const value = labels[rule.key];
    if (rule.type === 'exists') return has;
    if (rule.type === 'not-exists') return !has;
    if (rule.type === 'eq') return has && value === rule.value;
    if (rule.type === 'neq') return !has || value !== rule.value;
    if (rule.type === 'in') return has && rule.values.includes(value);
    if (rule.type === 'notin') return !has || !rule.values.includes(value);
    return false;
  });
}

export function mount(root, { markComplete }) {
  const pods = [
    { name:'web-7d9-a', labels:{ app:'web', env:'prod', track:'stable', tier:'frontend' } },
    { name:'web-7d9-b', labels:{ app:'web', env:'prod', track:'canary', tier:'frontend' } },
    { name:'api-684-a', labels:{ app:'api', env:'prod', track:'stable', tier:'backend' } },
    { name:'worker-55f-a', labels:{ app:'worker', env:'qa', track:'daily', tier:'backend' } }
  ];
  const state = { selector:'app=web,env=prod', serviceSelector:'app=web', selected:0 };

  root.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="eyebrow">Labels</div><h2>Metadata that becomes a grouping primitive</h2>
        <p class="hero-copy">Labels do not make an object unique. They let clients, controllers and Services select sets of objects.</p>
        <div id="pods"></div>
      </div>
      <div class="panel">
        <div class="eyebrow">Selector playground</div>
        <div class="control"><label>Label selector</label><input id="selector" value="app=web,env=prod" placeholder="app=web,env=prod"></div>
        <div class="chip-row"><button class="chip-btn preset" data-selector="app=web">app=web</button><button class="chip-btn preset" data-selector="env in (prod,qa),tier=backend">set-based</button><button class="chip-btn preset" data-selector="track!=canary">not canary</button><button class="chip-btn preset" data-selector="!debug">missing key</button></div>
        <div id="selector-result" class="callout"></div>
        <div class="terminal" id="kubectl"></div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:16px">
      <div class="panel">
        <div class="eyebrow">Service membership</div><h3>Which Pods become endpoints?</h3>
        <div class="control" style="margin-top:12px"><label>Service selector</label><input id="service-selector" value="app=web"></div>
        <div id="service-result"></div>
        <div class="callout warn"><strong>A Service does not “contain Pods”.</strong><p>Controllers derive EndpointSlice membership from Pods matching the Service selector and readiness state.</p></div>
      </div>
      <div class="panel">
        <div class="eyebrow">Edit a label</div><h3 id="selected-name"></h3>
        <div class="control" style="margin-top:12px"><label>track label</label><select id="track"><option>stable</option><option>canary</option><option>daily</option><option>experimental</option></select></div>
        <button class="primary-btn" id="update-label">Update label</button>
        <div class="callout"><strong>Loose coupling</strong><p>Changing metadata can change which queries, Services, or controllers consider an object part of a set—without changing the container image.</p></div>
      </div>
    </div>

    <div class="panel" style="margin-top:16px">
      <div class="eyebrow">Selector rules worth remembering</div>
      <div class="grid-3"><div class="metric"><span>Comma-separated requirements</span><strong>AND</strong></div><div class="metric"><span>Selector result</span><strong>0..N objects</strong></div><div class="metric"><span>Identity</span><strong>Not guaranteed</strong></div></div>
      <div class="callout danger"><strong>Controller selectors must be designed carefully.</strong><p>Overlapping selectors can create conflicting ownership expectations for controller-managed Pods. Labels are powerful because they are the core grouping primitive.</p></div>
      <div class="callout success"><strong>Recommended convention</strong><p>For reusable tooling, prefer standard keys such as <code>app.kubernetes.io/name</code> where appropriate; Kubernetes does not require them, but they improve interoperability.</p></div>
      <button class="primary-btn" data-mark-complete>Mark lesson complete</button>
    </div>`;

  const $ = selector => root.querySelector(selector);

  function renderPods() {
    $('#pods').innerHTML = pods.map((pod, index) => `<button class="lesson-card pod-label-card ${index === state.selected ? 'selected' : ''}" data-pod-index="${index}" style="min-height:auto;margin-bottom:10px;width:100%"><div class="card-top"><strong>${pod.name}</strong><span class="badge">Pod</span></div><div class="chip-row">${Object.entries(pod.labels).map(([k,v]) => `<span class="badge">${k}=${v}</span>`).join('')}</div></button>`).join('');
  }

  function evaluate(raw, target, command) {
    try {
      const rules = parseSelector(raw);
      const selected = pods.filter(pod => matches(pod.labels, rules));
      if (target) {
        target.className = `callout ${selected.length ? 'success' : 'warn'}`;
        target.innerHTML = `<strong>${selected.length} Pod${selected.length === 1 ? '' : 's'} matched</strong><p>${selected.length ? selected.map(p => p.name).join(', ') : 'No Pod currently satisfies every requirement.'}</p>`;
      }
      if (command) $('#kubectl').textContent = `$ kubectl get pods -l '${raw}'\n${selected.map(p => p.name).join('\n') || 'No resources found'}`;
      return selected;
    } catch (error) {
      if (target) {
        target.className = 'callout danger';
        target.innerHTML = `<strong>Selector parse error</strong><p>${error.message}</p>`;
      }
      if (command) $('#kubectl').textContent = '$ kubectl get pods -l ...\ninvalid selector in this teaching parser';
      return [];
    }
  }

  function render() {
    renderPods();
    $('#selected-name').textContent = pods[state.selected].name;
    $('#track').value = pods[state.selected].labels.track || 'stable';
    evaluate(state.selector, $('#selector-result'), true);
    const serviceSelected = evaluate(state.serviceSelector, null, false);
    $('#service-result').innerHTML = `<div class="grid-3"><div class="metric"><span>Service</span><strong>web-svc</strong></div><div class="metric"><span>Selector</span><strong>${state.serviceSelector || '∅'}</strong></div><div class="metric"><span>Matching Pods</span><strong>${serviceSelected.length}</strong></div></div><div class="chip-row" style="margin-top:12px">${serviceSelected.map(p => `<span class="badge">→ ${p.name}</span>`).join('') || '<span class="badge">No endpoints selected</span>'}</div>`;
  }

  function selectorInput(event) { state.selector = event.target.value; render(); }
  function serviceInput(event) { state.serviceSelector = event.target.value; render(); }
  function preset(event) { state.selector = event.currentTarget.dataset.selector; $('#selector').value = state.selector; render(); }
  function updateLabel() { pods[state.selected].labels.track = $('#track').value; render(); }
  function selectPod(event) {
    const button = event.target.closest('[data-pod-index]');
    if (!button || !root.contains(button)) return;
    state.selected = Number(button.dataset.podIndex);
    render();
  }
  function done() { markComplete(); }

  $('#selector').addEventListener('input', selectorInput); cleanup.push(() => $('#selector')?.removeEventListener('input', selectorInput));
  $('#service-selector').addEventListener('input', serviceInput); cleanup.push(() => $('#service-selector')?.removeEventListener('input', serviceInput));
  $('#pods').addEventListener('click', selectPod); cleanup.push(() => $('#pods')?.removeEventListener('click', selectPod));
  root.querySelectorAll('.preset').forEach(button => { button.addEventListener('click', preset); cleanup.push(() => button.removeEventListener('click', preset)); });
  $('#update-label').addEventListener('click', updateLabel); cleanup.push(() => $('#update-label')?.removeEventListener('click', updateLabel));
  root.querySelector('[data-mark-complete]').addEventListener('click', done); cleanup.push(() => root.querySelector('[data-mark-complete]')?.removeEventListener('click', done));
  render();
}

export function unmount() { cleanup.forEach(fn => { try { fn(); } catch {} }); cleanup = []; }
