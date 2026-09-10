let cleanup = [];

export function mount(root, { markComplete }) {
  const state = {
    zone: 'any',
    gpuOnly: false,
    tolerateGpu: false,
    requireSpot: false,
    nodes: [
      { name: 'node-a', zone: 'a', type: 'ondemand', gpu: false, taint: null },
      { name: 'node-b', zone: 'b', type: 'spot', gpu: false, taint: null },
      { name: 'node-c', zone: 'a', type: 'ondemand', gpu: true, taint: 'gpu=true:NoSchedule' },
      { name: 'node-d', zone: 'c', type: 'spot', gpu: true, taint: 'gpu=true:NoSchedule' }
    ]
  };

  root.innerHTML = `
    <div class="panel">
      <div class="eyebrow">Placement rules playground</div>
      <h2 style="margin-top:8px">Attract Pods with affinity. Repel them with taints.</h2>
      <p class="hero-copy">A toleration only removes a taint-based rejection. It does not force a Pod onto that node. Affinity and other scheduler rules still matter.</p>
      <div class="grid-2" style="margin-top:18px">
        <div>
          <div class="control"><label>Required zone <strong id="zone-label">Any</strong></label><select id="zone"><option value="any">Any zone</option><option value="a">zone-a</option><option value="b">zone-b</option><option value="c">zone-c</option></select></div>
          <label class="chip-btn" style="display:block;margin-bottom:8px"><input id="gpu" type="checkbox"> Require GPU node</label>
          <label class="chip-btn" style="display:block;margin-bottom:8px"><input id="tol" type="checkbox"> Add toleration for <code>gpu=true:NoSchedule</code></label>
          <label class="chip-btn" style="display:block"><input id="spot" type="checkbox"> Require <code>type=spot</code></label>
          <div class="math-box" id="yaml" style="white-space:pre-wrap"></div>
        </div>
        <div>
          <div class="node-grid" id="nodes"></div>
          <div id="result"></div>
        </div>
      </div>
    </div>

    <div class="grid-3" style="margin-top:14px">
      <div class="callout success" style="margin:0"><strong>Affinity</strong><p>Pod-side attraction or requirement based on node labels.</p></div>
      <div class="callout warn" style="margin:0"><strong>Taint</strong><p>Node-side repulsion. <code>NoSchedule</code> blocks new Pods without a matching toleration.</p></div>
      <div class="callout" style="margin:0"><strong>Toleration</strong><p>Permission to pass a taint check — not a reservation and not a guarantee.</p></div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="eyebrow">Mini challenge</div>
      <h3 style="margin-top:7px">Can a Pod tolerate a GPU taint and still land on a non-GPU node?</h3>
      <div class="chip-row" style="margin-top:12px"><button class="chip-btn quiz" data-a="yes">Yes</button><button class="chip-btn quiz" data-a="no">No</button></div>
      <div id="quiz-answer"></div>
      <button class="primary-btn" data-mark-complete style="margin-top:16px">Mark lesson complete</button>
    </div>`;

  const q = (s) => root.querySelector(s);

  function eligible(node) {
    if (state.zone !== 'any' && node.zone !== state.zone) return { ok: false, why: `zone mismatch` };
    if (state.gpuOnly && !node.gpu) return { ok: false, why: `GPU required` };
    if (state.requireSpot && node.type !== 'spot') return { ok: false, why: `spot required` };
    if (node.taint && !state.tolerateGpu) return { ok: false, why: `taint not tolerated` };
    return { ok: true, why: node.taint ? 'taint tolerated' : 'all hard checks pass' };
  }

  function render() {
    q('#zone-label').textContent = state.zone === 'any' ? 'Any' : `zone-${state.zone}`;
    q('#nodes').innerHTML = state.nodes.map((n) => {
      const e = eligible(n);
      return `<div class="node ${e.ok ? 'selected' : ''}"><div class="node-head"><strong>${n.name}</strong><span>${e.ok ? '✓ eligible' : '✕ filtered'}</span></div><div class="node-row"><span>zone</span><strong>${n.zone}</strong></div><div class="node-row"><span>type</span><strong>${n.type}</strong></div><div class="node-row"><span>GPU</span><strong>${n.gpu ? 'yes' : 'no'}</strong></div><div class="node-row"><span>taint</span><strong>${n.taint || 'none'}</strong></div><div class="callout ${e.ok ? 'success' : 'danger'}" style="margin-top:10px"><p>${e.why}</p></div></div>`;
    }).join('');

    const fits = state.nodes.filter((n) => eligible(n).ok);
    q('#result').innerHTML = fits.length
      ? `<div class="callout success"><strong>${fits.length} feasible node${fits.length > 1 ? 's' : ''}</strong><p>After hard filters pass, scheduler scoring plugins can rank the feasible nodes.</p></div>`
      : `<div class="callout danger"><strong>Pod stays Pending</strong><p>No node satisfies all required constraints. Relax a hard rule or add the needed toleration.</p></div>`;

    const affinity = [];
    if (state.zone !== 'any') affinity.push(`topology.kubernetes.io/zone: zone-${state.zone}`);
    if (state.gpuOnly) affinity.push(`accelerator: gpu`);
    if (state.requireSpot) affinity.push(`type: spot`);
    q('#yaml').textContent = `required node constraints:\n${affinity.length ? affinity.map((x) => `- ${x}`).join('\n') : '- none'}\n\ntolerations:\n${state.tolerateGpu ? '- gpu=true:NoSchedule' : '- none'}`;
  }

  const bind = (sel, event, fn) => { const el = q(sel); el.addEventListener(event, fn); cleanup.push(() => el.removeEventListener(event, fn)); };
  bind('#zone', 'change', (e) => { state.zone = e.target.value; render(); });
  bind('#gpu', 'change', (e) => { state.gpuOnly = e.target.checked; render(); });
  bind('#tol', 'change', (e) => { state.tolerateGpu = e.target.checked; render(); });
  bind('#spot', 'change', (e) => { state.requireSpot = e.target.checked; render(); });
  root.querySelectorAll('.quiz').forEach((b) => {
    const fn = () => { q('#quiz-answer').innerHTML = b.dataset.a === 'yes' ? `<div class="callout success"><strong>Correct.</strong><p>Tolerating a taint only permits the GPU node; without affinity/nodeSelector, ordinary nodes can still be feasible.</p></div>` : `<div class="callout danger"><strong>Not quite.</strong><p>Toleration removes a rejection. To require GPU nodes, combine it with a node label constraint/affinity.</p></div>`; };
    b.addEventListener('click', fn); cleanup.push(() => b.removeEventListener('click', fn));
  });
  bind('[data-mark-complete]', 'click', markComplete);
  render();
}

export function unmount() { cleanup.forEach((fn) => { try { fn(); } catch {} }); cleanup = []; }
