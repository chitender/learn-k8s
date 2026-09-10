let cleanup=[];

export function mount(root,{markComplete}){
  const state={mode:'hpa',replicas:3,min:2,max:10,cpuRequest:0.5,cpuUsage:0.45,target:60,nodeCapacity:4,nodes:1};
  root.innerHTML=`
    <div class="panel">
      <div class="eyebrow">Three autoscalers, three different questions</div><h2 style="margin-top:8px">More Pods? Bigger requests? More Nodes?</h2>
      <p class="hero-copy">Horizontal workload autoscaling changes replica count. Vertical autoscaling rightsizes Pod resources. Node autoscaling adds/removes compute capacity so requested Pods can be scheduled.</p>
      <div class="tabs" style="margin-top:16px"><button class="tab active" data-mode="hpa">HPA · replicas</button><button class="tab" data-mode="vpa">VPA · requests</button><button class="tab" data-mode="node">Node autoscaling</button></div>
      <div class="grid-2">
        <div>
          <div class="control"><label>Current replicas <strong id="replicas-label"></strong></label><input id="replicas" type="range" min="1" max="10" value="3"></div>
          <div class="control"><label>CPU request / Pod <strong id="request-label"></strong></label><input id="request" type="range" min="0.1" max="2" step="0.1" value="0.5"></div>
          <div class="control"><label>CPU usage / Pod <strong id="usage-label"></strong></label><input id="usage" type="range" min="0.05" max="2" step="0.05" value="0.45"></div>
          <div class="control hpa-only"><label>HPA target utilization <strong id="target-label"></strong></label><input id="target" type="range" min="20" max="100" step="5" value="60"></div>
          <div class="control node-only" hidden><label>Node allocatable CPU <strong id="nodecap-label"></strong></label><input id="nodecap" type="range" min="2" max="16" step="1" value="4"></div>
          <div class="control node-only" hidden><label>Current nodes <strong id="nodes-label"></strong></label><input id="nodes" type="range" min="1" max="6" step="1" value="1"></div>
        </div>
        <div id="visual"></div>
      </div>
    </div>

    <div class="grid-3" style="margin-top:14px">
      <div class="callout success" style="margin:0"><strong>HPA</strong><p>Changes replica count from observed metrics. With CPU utilization targets, the request is part of the denominator.</p></div>
      <div class="callout" style="margin:0"><strong>VPA</strong><p>Adjusts workload resource requests/limits toward observed need; it is a separate controller/add-on rather than the built-in HPA API.</p></div>
      <div class="callout warn" style="margin:0"><strong>Node autoscaler</strong><p>Reacts to scheduling constraints such as Pod resource requests. It does not directly scale nodes from live Pod CPU usage alone.</p></div>
    </div>

    <div class="panel" style="margin-top:14px"><div class="eyebrow">Key experiment</div><h3 style="margin-top:7px">Keep usage fixed, then change only the CPU request.</h3><p style="color:var(--muted)">In HPA CPU-utilization mode, the same 450m usage is 90% of a 500m request but only 45% of a 1 CPU request. Requests therefore influence both scheduling and the HPA utilization signal.</p><button class="primary-btn" data-mark-complete>Mark lesson complete</button></div>`;
  const q=s=>root.querySelector(s),qa=s=>[...root.querySelectorAll(s)];
  const cpu=x=>x<1?`${Math.round(x*1000)}m`:`${Number(x.toFixed(1))} CPU`;
  function render(){
    q('#replicas-label').textContent=state.replicas;q('#request-label').textContent=cpu(state.cpuRequest);q('#usage-label').textContent=cpu(state.cpuUsage);q('#target-label').textContent=`${state.target}%`;q('#nodecap-label').textContent=`${state.nodeCapacity} CPU`;q('#nodes-label').textContent=state.nodes;
    qa('.node-only').forEach(el=>el.hidden=state.mode!=='node');qa('.hpa-only').forEach(el=>el.hidden=state.mode!=='hpa');
    let html='';
    if(state.mode==='hpa'){
      const util=state.cpuUsage/state.cpuRequest*100;
      const desired=Math.max(state.min,Math.min(state.max,Math.ceil(state.replicas*util/state.target)));
      html=`<div class="metric"><span>Current average utilization</span><strong>${util.toFixed(0)}%</strong></div><div class="math-box">desiredReplicas ≈ ceil(currentReplicas × currentUtilization / target)\n= ceil(${state.replicas} × ${util.toFixed(0)} / ${state.target})\n= ${desired}</div><div class="callout ${desired>state.replicas?'warn':'success'}"><strong>${state.replicas} → ${desired} replicas</strong><p>${desired>state.replicas?'Observed utilization is above target, so HPA wants more Pods.':desired<state.replicas?'Observed utilization is below target, so HPA can scale down subject to configured behavior/stabilization.':'Current replica count matches this simplified calculation.'}</p></div>`;
    } else if(state.mode==='vpa'){
      const headroom=1.25; const recommended=Math.max(0.1,Math.ceil(state.cpuUsage*headroom*10)/10);
      html=`<div class="metric"><span>Observed usage</span><strong>${cpu(state.cpuUsage)}</strong></div><div class="metric" style="margin-top:10px"><span>Illustrative recommendation</span><strong>${cpu(recommended)} request</strong></div><div class="math-box">teaching model only:\nrecommendation ≈ observed usage × 1.25 headroom\n${cpu(state.cpuUsage)} × 1.25 → ${cpu(recommended)}</div><div class="callout"><strong>VPA is rightsizing, not replica scaling.</strong><p>Real VPA recommendations consider historical usage and controller policy; this visualization intentionally simplifies the estimator.</p></div>`;
    } else {
      const requestedTotal=state.replicas*state.cpuRequest; const clusterCpu=state.nodes*state.nodeCapacity; const fit=Math.floor(clusterCpu/state.cpuRequest); const pending=Math.max(0,state.replicas-fit); const needed=Math.max(state.nodes,Math.ceil(requestedTotal/state.nodeCapacity));
      html=`<div class="grid-3"><div class="metric"><span>Cluster allocatable</span><strong>${clusterCpu} CPU</strong></div><div class="metric"><span>Pod requests total</span><strong>${requestedTotal.toFixed(1)} CPU</strong></div><div class="metric"><span>Pending by CPU fit</span><strong>${pending}</strong></div></div><div class="math-box">${state.replicas} Pods × ${cpu(state.cpuRequest)} request = ${requestedTotal.toFixed(1)} CPU requested\n${state.nodes} node(s) × ${state.nodeCapacity} CPU = ${clusterCpu} CPU allocatable\nillustrative nodes needed ≈ ${needed}</div><div class="callout ${pending?'warn':'success'}"><strong>${pending?`${pending} Pod(s) cannot fit by CPU request`:'All Pods fit by CPU request'}</strong><p>${pending?`A node autoscaler can consider provisioning capacity compatible with the pending Pods' requests and other scheduling constraints.`:'No CPU-fit pressure exists in this simplified scenario.'}</p></div>`;
    }
    q('#visual').innerHTML=html;
  }
  const bind=(sel,ev,fn)=>{const el=q(sel);el.addEventListener(ev,fn);cleanup.push(()=>el.removeEventListener(ev,fn));};
  const sliders={replicas:'replicas',request:'cpuRequest',usage:'cpuUsage',target:'target',nodecap:'nodeCapacity',nodes:'nodes'};
  Object.entries(sliders).forEach(([id,key])=>bind(`#${id}`,'input',e=>{state[key]=Number(e.target.value);render();}));
  qa('[data-mode]').forEach(b=>{const fn=()=>{state.mode=b.dataset.mode;qa('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));render();};b.addEventListener('click',fn);cleanup.push(()=>b.removeEventListener('click',fn));});
  bind('[data-mark-complete]','click',markComplete);render();
}
export function unmount(){cleanup.forEach(fn=>{try{fn();}catch{}});cleanup=[];}
