let cleanup = [];

export function mount(root, { markComplete }) {
  const state = { srcNode: 'node-a', dstNode: 'node-b', policy: false, samePod: false };
  root.innerHTML = `
    <div class="panel">
      <div class="eyebrow">Packet journey</div><h2 style="margin-top:8px">Every Pod gets an IP. Now trace the packet.</h2>
      <p class="hero-copy">Kubernetes defines the network model; a CNI implementation wires interfaces, routes and policy enforcement on each node.</p>
      <div class="grid-2" style="margin-top:18px">
        <div>
          <div class="control"><label>Source Pod node</label><select id="src"><option>node-a</option><option>node-b</option></select></div>
          <div class="control"><label>Destination Pod node</label><select id="dst"><option>node-a</option><option selected>node-b</option></select></div>
          <label class="chip-btn" style="display:block;margin-bottom:8px"><input type="checkbox" id="same"> Destination is another container in the same Pod</label>
          <label class="chip-btn" style="display:block"><input type="checkbox" id="policy"> Apply a NetworkPolicy that denies this flow</label>
          <div id="summary"></div>
        </div>
        <div class="panel" style="padding:15px;box-shadow:none">
          <div id="path" class="flow"></div>
          <div id="detail" class="callout" style="margin-top:14px"></div>
        </div>
      </div>
    </div>

    <div class="grid-3" style="margin-top:14px">
      <div class="metric"><span>Pod IP</span><strong>Identity on the cluster network</strong><p style="color:var(--muted);font-size:12px">Pods are replaceable, so clients normally discover them through Services instead of hard-coding Pod IPs.</p></div>
      <div class="metric"><span>Same Pod</span><strong>localhost</strong><p style="color:var(--muted);font-size:12px">Containers in one Pod share the Pod's network namespace and can reach each other over loopback.</p></div>
      <div class="metric"><span>Cross-node</span><strong>CNI data path</strong><p style="color:var(--muted);font-size:12px">The exact implementation can be routes, overlays, cloud-native networking or eBPF.</p></div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="eyebrow">Try this</div><h3 style="margin-top:7px">What changes when both Pods move onto the same node?</h3>
      <p style="color:var(--muted)">The Kubernetes network model stays the same: Pod A sends to Pod B's IP. The underlying data path becomes node-local rather than crossing nodes.</p>
      <button class="primary-btn" data-mark-complete>Mark lesson complete</button>
    </div>`;

  const q = (s) => root.querySelector(s);
  function render() {
    const sameNode = state.srcNode === state.dstNode;
    const steps = state.samePod
      ? ['Container A', 'localhost', 'Container B']
      : sameNode
        ? ['Pod A', 'veth', 'node network', 'veth', 'Pod B']
        : ['Pod A', 'veth', state.srcNode, 'CNI cross-node path', state.dstNode, 'veth', 'Pod B'];
    q('#path').innerHTML = steps.map((s, i) => `<button class="flow-step ${i === 0 ? 'active' : ''}"><strong>${i + 1}. ${s}</strong><small>${state.policy && i === steps.length - 1 ? 'blocked by policy' : 'packet step'}</small></button>`).join('');
    q('#detail').className = `callout ${state.policy ? 'danger' : 'success'}`;
    q('#detail').innerHTML = state.policy
      ? `<strong>Traffic denied</strong><p>A NetworkPolicy-capable network implementation can drop the flow even though IP routing exists.</p>`
      : `<strong>${state.samePod ? 'Loopback path' : sameNode ? 'Node-local Pod-to-Pod path' : 'Cross-node Pod-to-Pod path'}</strong><p>The destination is addressed by Pod IP. Kubernetes does not require an application-level NAT hop between Pods in the abstract network model.</p>`;
    q('#summary').innerHTML = `<div class="math-box">source = ${state.samePod ? 'same Pod' : state.srcNode}\ndestination = ${state.samePod ? 'same Pod / localhost' : state.dstNode}\npolicy = ${state.policy ? 'deny' : 'allow'}\npath = ${steps.join(' → ')}</div>`;
  }
  const bind = (sel, ev, fn) => { const el=q(sel); el.addEventListener(ev,fn); cleanup.push(()=>el.removeEventListener(ev,fn)); };
  bind('#src','change',(e)=>{state.srcNode=e.target.value;render();});
  bind('#dst','change',(e)=>{state.dstNode=e.target.value;render();});
  bind('#same','change',(e)=>{state.samePod=e.target.checked;render();});
  bind('#policy','change',(e)=>{state.policy=e.target.checked;render();});
  bind('[data-mark-complete]','click',markComplete);
  render();
}

export function unmount(){cleanup.forEach((fn)=>{try{fn();}catch{}});cleanup=[];}
