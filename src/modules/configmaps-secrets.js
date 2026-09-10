let cleanup=[];
export function mount(root,{markComplete}){
  const state={source:'configmap',mode:'env',value:'api.internal.svc',podValue:'api.internal.svc',restarted:false};
  root.innerHTML=`
  <div class="grid-2"><div class="panel"><div class="eyebrow">Configuration without rebuilding images</div><h2>ConfigMap vs Secret</h2>
  <div class="chip-row" style="margin:14px 0"><button class="chip-btn active" data-source="configmap">ConfigMap</button><button class="chip-btn" data-source="secret">Secret</button></div>
  <div class="control"><label>Consumption mode <span id="mode-label">Environment variable</span></label><select id="mode"><option value="env">Environment variable</option><option value="volume">Projected volume</option></select></div>
  <div class="control"><label>Stored value</label><input id="value" type="text" value="api.internal.svc"></div>
  <div class="chip-row"><button class="primary-btn" id="change">Change object value</button><button class="chip-btn" id="restart">Restart Pod</button></div></div>
  <div class="panel"><div class="eyebrow">What the Pod sees</div><div id="result"></div><div class="terminal" id="yaml" style="margin-top:14px"></div></div></div>
  <div class="grid-3" style="margin-top:14px"><div class="metric"><span>ConfigMap</span><strong>Non-confidential config</strong><p style="color:var(--muted);font-size:12px">Key/value data consumed as env vars, args or files.</p></div><div class="metric"><span>Secret</span><strong>Sensitive data</strong><p style="color:var(--muted);font-size:12px">Base64 is encoding, not encryption. Protect with RBAC and encryption at rest.</p></div><div class="metric"><span>Update behavior</span><strong>Depends on consumption</strong><p style="color:var(--muted);font-size:12px">Env vars require a new container. Projected volumes can refresh eventually.</p></div></div>
  <div class="panel" style="margin-top:14px"><button class="primary-btn" data-mark-complete>Mark lesson complete</button></div>`;
  const $=s=>root.querySelector(s);
  function render(){
    const secret=state.source==='secret';
    const shown=state.mode==='env'?state.podValue:state.value;
    $('#result').innerHTML=`<div class="callout ${secret?'warn':'success'}"><strong>${secret?'Secret':'ConfigMap'} selected</strong><p>${secret?'Use this for confidential material, but do not assume the object is automatically encrypted in etcd.':'Use this for non-confidential application configuration.'}</p></div><div class="metric" style="margin-top:12px"><span>Application currently reads</span><strong>${shown}</strong><p style="color:var(--muted);font-size:12px">${state.mode==='env'?'Environment variables are fixed for the running container. Restart/recreate it to receive a changed value.':'Projected ConfigMap/Secret volumes are updated asynchronously by kubelet; applications still need to reread the file.'}</p></div>`;
    $('#yaml').textContent=secret?`apiVersion: v1\nkind: Secret\nmetadata:\n  name: app-config\ntype: Opaque\nstringData:\n  DATABASE_PASSWORD: ${state.value}`:`apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app-config\ndata:\n  API_HOST: ${state.value}`;
  }
  root.querySelectorAll('[data-source]').forEach(b=>{const fn=()=>{state.source=b.dataset.source;root.querySelectorAll('[data-source]').forEach(x=>x.classList.toggle('active',x===b));render()};b.addEventListener('click',fn);cleanup.push(()=>b.removeEventListener('click',fn))});
  const mode=$('#mode'); const mf=()=>{state.mode=mode.value;$('#mode-label').textContent=state.mode==='env'?'Environment variable':'Projected volume';render()};mode.addEventListener('change',mf);cleanup.push(()=>mode.removeEventListener('change',mf));
  const ch=()=>{state.value=$('#value').value||'(empty)';render()};$('#change').addEventListener('click',ch);cleanup.push(()=>$('#change').removeEventListener('click',ch));
  const rs=()=>{state.podValue=state.value;state.restarted=true;render()};$('#restart').addEventListener('click',rs);cleanup.push(()=>$('#restart').removeEventListener('click',rs));
  const done=()=>markComplete();root.querySelector('[data-mark-complete]').addEventListener('click',done);cleanup.push(()=>root.querySelector('[data-mark-complete]')?.removeEventListener('click',done));render();
}
export function unmount(){cleanup.forEach(fn=>{try{fn()}catch{}});cleanup=[];}
