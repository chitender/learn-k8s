let cleanup=[];
export function mount(root,{markComplete}){
 const components={
  client:['kubectl / client','Sends an authenticated HTTP request to the Kubernetes API.'],
  api:['kube-apiserver','The front door of the control plane. Validates API requests and exposes cluster state.'],
  etcd:['etcd','Durable key-value store for Kubernetes API state. Controllers do not use etcd directly; they go through the API server.'],
  controller:['controller manager','Runs reconciliation loops: compare desired state with observed state and act to close the gap.'],
  scheduler:['kube-scheduler','Watches for unscheduled Pods, filters/scores nodes, then records a node binding through the API.'],
  kubelet:['kubelet','Node agent. Watches PodSpecs assigned to its node and works with the runtime to make containers run.'],
  runtime:['container runtime','Pulls images and creates containers/sandboxes via CRI.'],
  pod:['Pod','The workload finally runs on a worker node.']
 };
 root.innerHTML=`
 <div class="tabs"><button class="tab active" data-tab="flow">① Follow a request</button><button class="tab" data-tab="failure">② Break a component</button><button class="tab" data-tab="quiz">③ Challenge</button></div>
 <section data-page="flow">
  <div class="panel"><div class="eyebrow">Control plane mental model</div><h2 style="margin-top:7px">Create a Pod: who does what?</h2><p class="hero-copy">Click each component in order. The important idea: Kubernetes is a collection of cooperating control loops around an API, not one giant daemon.</p>
   <div class="flow" id="arch-flow" style="margin-top:18px">${Object.entries(components).map(([k,v],i)=>`<button class="flow-step ${i===0?'active':''}" data-component="${k}"><strong>${i+1}. ${v[0]}</strong><small>${['submit','validate/store','persist','reconcile','place','realize','start','running'][i]}</small></button>`).join('')}</div>
   <div id="arch-detail" class="callout"></div>
  </div>
  <div class="grid-3" style="margin-top:14px"><div class="metric"><span>Control plane</span><strong>Decides + stores</strong></div><div class="metric"><span>Worker node</span><strong>Runs workloads</strong></div><div class="metric"><span>Core pattern</span><strong>Watch → compare → act</strong></div></div>
 </section>
 <section data-page="failure" hidden><div class="grid-2"><div class="panel"><div class="eyebrow">Failure lab</div><h2 style="margin-top:7px">Take one component away</h2><div class="chip-row" style="margin-top:16px">${['api','etcd','scheduler','controller','kubelet'].map(x=>`<button class="chip-btn" data-break="${x}">${components[x][0]}</button>`).join('')}</div></div><div class="panel"><div class="eyebrow">Impact</div><div id="failure-result" class="callout" style="margin-top:14px">Pick a component and predict what stops working.</div></div></div></section>
 <section data-page="quiz" hidden><div class="panel"><div class="eyebrow">Quick check</div><h2 style="margin-top:7px">Who schedules an unscheduled Pod?</h2><div class="quiz-options" style="margin-top:14px"><button class="chip-btn" data-answer="0">kubelet</button><button class="chip-btn" data-answer="1">kube-scheduler</button><button class="chip-btn" data-answer="0">etcd</button></div><div id="quiz-result"></div><button class="primary-btn" data-mark-complete style="margin-top:18px">Mark lesson complete</button></div></section>`;
 const detail=root.querySelector('#arch-detail'); const keys=Object.keys(components);
 function show(k){root.querySelectorAll('[data-component]').forEach(b=>b.classList.toggle('active',b.dataset.component===k));const [n,d]=components[k];detail.innerHTML=`<strong>${n}</strong><p>${d}</p>`} show(keys[0]);
 root.querySelectorAll('[data-component]').forEach(b=>{const f=()=>show(b.dataset.component);b.addEventListener('click',f);cleanup.push(()=>b.removeEventListener('click',f))});
 const impacts={api:'New API operations fail. Controllers, scheduler and kubelets also lose their normal coordination path to cluster state.',etcd:'The API server cannot reliably persist/read Kubernetes state. Existing containers may keep running temporarily, but control-plane state management is critically impaired.',scheduler:'Already-running Pods continue. Newly created Pods that need placement remain Pending until a scheduler assigns them.',controller:'The API still accepts objects and the scheduler can place Pods, but many desired-state reconciliation loops stop correcting drift.',kubelet:'Only that node loses its local agent. Containers may continue for a time, but Pod lifecycle/status and desired-state realization on that node break.'};
 root.querySelectorAll('[data-break]').forEach(b=>{const f=()=>{root.querySelector('#failure-result').innerHTML=`<strong>${components[b.dataset.break][0]} unavailable</strong><p>${impacts[b.dataset.break]}</p>`};b.addEventListener('click',f);cleanup.push(()=>b.removeEventListener('click',f))});
 root.querySelectorAll('[data-answer]').forEach(b=>{const f=()=>{root.querySelector('#quiz-result').innerHTML=b.dataset.answer==='1'?'<div class="callout success"><strong>Correct.</strong><p>The scheduler watches unscheduled Pods and selects a suitable node.</p></div>':'<div class="callout danger"><strong>Not quite.</strong><p>Think about the component whose job is placement.</p></div>'};b.addEventListener('click',f);cleanup.push(()=>b.removeEventListener('click',f))});
 const complete=root.querySelector('[data-mark-complete]');complete.addEventListener('click',markComplete);cleanup.push(()=>complete.removeEventListener('click',markComplete));
 bindTabs(root);
}
function bindTabs(root){root.querySelectorAll('[data-tab]').forEach(b=>{const f=()=>{root.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));root.querySelectorAll('[data-page]').forEach(p=>p.hidden=p.dataset.page!==b.dataset.tab)};b.addEventListener('click',f);cleanup.push(()=>b.removeEventListener('click',f))})}
export function unmount(){cleanup.forEach(f=>{try{f()}catch{}});cleanup=[];}
