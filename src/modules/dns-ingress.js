let cleanup = [];

export function mount(root, { markComplete }) {
  const state = { namespace: 'shop', host: 'shop.example.com', path: '/api', ingressController: true, endpointReady: true };
  root.innerHTML = `
    <div class="panel">
      <div class="eyebrow">Name resolution + north-south traffic</div>
      <h2 style="margin-top:8px">DNS finds the Service. Ingress routes HTTP to it.</h2>
      <p class="hero-copy">A Service gets a stable virtual identity. Cluster DNS resolves Service names. An Ingress object only has an effect when an Ingress controller is installed and watching it.</p>
      <div class="grid-2" style="margin-top:18px">
        <div>
          <div class="control"><label>Namespace</label><select id="ns"><option>shop</option><option>prod</option><option>payments</option></select></div>
          <div class="control"><label>Ingress host</label><input id="host" type="text" value="shop.example.com"></div>
          <div class="control"><label>HTTP path</label><input id="route" type="text" value="/api"></div>
          <label class="chip-btn" style="display:block;margin-bottom:8px"><input type="checkbox" id="controller" checked> Ingress controller running</label>
          <label class="chip-btn" style="display:block"><input type="checkbox" id="ready" checked> Service has a Ready endpoint</label>
        </div>
        <div>
          <div id="dns" class="math-box"></div>
          <div id="route-flow" class="flow" style="margin-top:12px"></div>
          <div id="outcome"></div>
        </div>
      </div>
    </div>

    <div class="grid-3" style="margin-top:14px">
      <div class="callout" style="margin:0"><strong>Short Service name</strong><p><code>checkout</code> usually resolves from Pods in the same namespace search domain.</p></div>
      <div class="callout success" style="margin:0"><strong>Cross namespace</strong><p>Use a qualified name such as <code>checkout.shop.svc.cluster.local</code>.</p></div>
      <div class="callout warn" style="margin:0"><strong>Ingress ≠ controller</strong><p>The API object describes rules; a controller implements them.</p></div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="eyebrow">Challenge</div><h3 style="margin-top:7px">Ingress rule exists, DNS points at your load balancer, but requests return 503. What should you inspect?</h3>
      <div class="chip-row" style="margin-top:12px"><button class="chip-btn ans" data-a="endpoints">Service endpoints/readiness</button><button class="chip-btn ans" data-a="etcd">etcd disk size first</button></div>
      <div id="answer"></div>
      <button class="primary-btn" data-mark-complete style="margin-top:16px">Mark lesson complete</button>
    </div>`;

  const q=(s)=>root.querySelector(s);
  function render(){
    const fqdn=`checkout.${state.namespace}.svc.cluster.local`;
    q('#dns').innerHTML=`Pod asks CoreDNS:<br><span style="color:var(--cyan)">${fqdn}</span><br><br>DNS answer → Service virtual IP / discovery record`;
    const steps=['Client','Ingress endpoint','Ingress controller','Service','Ready endpoint','Pod'];
    q('#route-flow').innerHTML=steps.map((s,i)=>`<div class="flow-step"><strong>${i+1}. ${s}</strong><small>${i===2&&!state.ingressController?'missing':''}${i===4&&!state.endpointReady?'none':''}</small></div>`).join('');
    let html;
    if(!state.ingressController) html=`<div class="callout danger"><strong>No controller to implement the rule</strong><p>The Ingress object can exist in the API while no data-plane component actually serves it.</p></div>`;
    else if(!state.endpointReady) html=`<div class="callout danger"><strong>Routing reaches the Service, but there is no Ready backend</strong><p>Check EndpointSlices, Pod readiness, selector labels and backend health.</p></div>`;
    else html=`<div class="callout success"><strong>Request can route</strong><p>Host <code>${state.host}</code> + path <code>${state.path}</code> → Service → Ready Pod.</p></div>`;
    q('#outcome').innerHTML=html;
  }
  const bind=(sel,ev,fn)=>{const el=q(sel);el.addEventListener(ev,fn);cleanup.push(()=>el.removeEventListener(ev,fn));};
  bind('#ns','change',(e)=>{state.namespace=e.target.value;render();});
  bind('#host','input',(e)=>{state.host=e.target.value;render();});
  bind('#route','input',(e)=>{state.path=e.target.value;render();});
  bind('#controller','change',(e)=>{state.ingressController=e.target.checked;render();});
  bind('#ready','change',(e)=>{state.endpointReady=e.target.checked;render();});
  root.querySelectorAll('.ans').forEach((b)=>{const fn=()=>{q('#answer').innerHTML=b.dataset.a==='endpoints'?`<div class="callout success"><strong>Yes.</strong><p>Start at the Service's EndpointSlices and Pod readiness because a 503 often means the proxy/controller has no healthy backend.</p></div>`:`<div class="callout danger"><strong>Too far from the symptom.</strong><p>Follow the request path first: Ingress controller → Service → EndpointSlice → Pod readiness.</p></div>`};b.addEventListener('click',fn);cleanup.push(()=>b.removeEventListener('click',fn));});
  bind('[data-mark-complete]','click',markComplete);render();
}
export function unmount(){cleanup.forEach((fn)=>{try{fn();}catch{}});cleanup=[];}
