let cleanup = [];

export function mount(root, { markComplete }) {
  const state = { replicas: 3, ready: 3, image: 'nginx:1.27', namespace: 'default', selected: 'spec' };

  root.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="eyebrow">The Kubernetes API object</div>
        <h2>Manifest ≠ running state</h2>
        <p class="hero-copy">A manifest expresses intent. The API stores an object with identity and desired state; controllers and node components continuously update observed status.</p>
        <div class="chip-row" id="field-tabs">
          ${['apiVersion','kind','metadata','spec','status'].map(field => `<button class="chip-btn ${field === 'spec' ? 'active' : ''}" data-field="${field}">${field}</button>`).join('')}
        </div>
        <div id="field-explain" class="callout" style="margin-top:14px"></div>
        <div class="control" style="margin-top:18px"><label>Desired replicas <strong id="replicas-v"></strong></label><input id="replicas" type="range" min="0" max="6" step="1" value="3"></div>
        <div class="control"><label>Container image</label><select id="image"><option>nginx:1.27</option><option>nginx:1.28</option><option>registry.example/web:v2</option></select></div>
        <div class="chip-row"><button class="primary-btn" id="apply">kubectl apply</button><button class="chip-btn" id="fail">Simulate Pod failure</button><button class="chip-btn" id="reconcile">Run reconciliation</button></div>
      </div>
      <div class="panel">
        <div class="eyebrow">Manifest sent by the user</div>
        <pre class="terminal" id="manifest" style="white-space:pre-wrap"></pre>
        <div class="callout warn"><strong>Notice what is missing</strong><p>You normally declare <code>spec</code>. You do not author the controller-owned <code>status</code> field in your workload manifest.</p></div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:16px">
      <div class="panel"><div class="eyebrow">Object stored / observed</div><div id="object-state"></div></div>
      <div class="panel">
        <div class="eyebrow">Discover instead of memorizing</div>
        <div class="terminal">$ kubectl api-resources\nNAME          SHORTNAMES   APIVERSION   NAMESPACED   KIND\ndeployments   deploy       apps/v1      true         Deployment\n\n$ kubectl explain deployments.spec\nKIND: Deployment\nVERSION: apps/v1\nFIELD: spec &lt;DeploymentSpec&gt;</div>
        <div class="callout success"><strong>The cluster publishes its API schema.</strong><p><code>kubectl api-resources</code> discovers resources served by the API server; <code>kubectl explain</code> reads schema information instead of relying on memory.</p></div>
      </div>
    </div>

    <div class="panel" style="margin-top:16px">
      <div class="eyebrow">Mental model</div>
      <div class="flow" style="grid-template-columns:repeat(5,minmax(130px,1fr))">
        <div class="flow-step active"><strong>apiVersion + kind</strong><small>Which API type?</small></div>
        <div class="flow-step active"><strong>metadata</strong><small>Which object?</small></div>
        <div class="flow-step active"><strong>spec</strong><small>What do I want?</small></div>
        <div class="flow-step active"><strong>controller</strong><small>Close the gap</small></div>
        <div class="flow-step active"><strong>status</strong><small>What is observed?</small></div>
      </div>
      <div class="callout"><strong>YAML is only a serialization format.</strong><p>Kubernetes works through its API. YAML is a convenient way to describe the JSON-shaped object sent to that API.</p></div>
      <button class="primary-btn" data-mark-complete>Mark lesson complete</button>
    </div>`;

  const $ = selector => root.querySelector(selector);
  const fieldText = {
    apiVersion: ['Which API version?', 'For a Deployment, apps/v1 identifies the API group and version used to interpret the object.'],
    kind: ['Which resource type?', 'kind tells the API server which schema and behavior this object belongs to.'],
    metadata: ['Which object?', 'metadata carries identity and organization such as name, namespace, labels and annotations.'],
    spec: ['What do you want?', 'spec is the desired state supplied by the user for objects that define one. Controllers observe it and work toward it.'],
    status: ['What does Kubernetes observe?', 'status is current observed state written by Kubernetes components. A gap between spec and status is a signal for reconciliation.']
  };

  function render() {
    $('#replicas-v').textContent = state.replicas;
    $('#manifest').textContent = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\n  namespace: ${state.namespace}\n  labels:\n    app.kubernetes.io/name: web\nspec:\n  replicas: ${state.replicas}\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n      - name: web\n        image: ${state.image}`;

    const drift = state.replicas - state.ready;
    $('#object-state').innerHTML = `
      <div class="grid-3"><div class="metric"><span>spec.replicas</span><strong>${state.replicas}</strong></div><div class="metric"><span>status.readyReplicas</span><strong>${state.ready}</strong></div><div class="metric"><span>Drift</span><strong>${drift}</strong></div></div>
      <div class="callout ${drift === 0 ? 'success' : 'warn'}"><strong>${drift === 0 ? 'Desired and observed state match' : 'Reconciliation needed'}</strong><p>${drift === 0 ? 'The controller currently observes the requested number of Ready replicas.' : `The Deployment wants ${state.replicas}; only ${state.ready} are Ready.`}</p></div>`;

    const [title, text] = fieldText[state.selected];
    $('#field-explain').innerHTML = `<strong>${title}</strong><p>${text}</p>`;
  }

  function onField(event) {
    state.selected = event.currentTarget.dataset.field;
    root.querySelectorAll('[data-field]').forEach(button => button.classList.toggle('active', button === event.currentTarget));
    render();
  }
  function onReplicas(event) { state.replicas = Number(event.target.value); render(); }
  function onImage(event) { state.image = event.target.value; render(); }
  function apply() { state.ready = state.replicas; render(); }
  function fail() { state.ready = Math.max(0, state.ready - 1); render(); }
  function reconcile() { state.ready = state.replicas; render(); }
  function done() { markComplete(); }

  root.querySelectorAll('[data-field]').forEach(button => { button.addEventListener('click', onField); cleanup.push(() => button.removeEventListener('click', onField)); });
  $('#replicas').addEventListener('input', onReplicas); cleanup.push(() => $('#replicas')?.removeEventListener('input', onReplicas));
  $('#image').addEventListener('input', onImage); cleanup.push(() => $('#image')?.removeEventListener('input', onImage));
  $('#apply').addEventListener('click', apply); cleanup.push(() => $('#apply')?.removeEventListener('click', apply));
  $('#fail').addEventListener('click', fail); cleanup.push(() => $('#fail')?.removeEventListener('click', fail));
  $('#reconcile').addEventListener('click', reconcile); cleanup.push(() => $('#reconcile')?.removeEventListener('click', reconcile));
  root.querySelector('[data-mark-complete]').addEventListener('click', done); cleanup.push(() => root.querySelector('[data-mark-complete]')?.removeEventListener('click', done));
  render();
}

export function unmount() { cleanup.forEach(fn => { try { fn(); } catch {} }); cleanup = []; }
