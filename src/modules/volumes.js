let cleanup=[];

export function mount(root,{markComplete}){
  const state={kind:'emptyDir',restart:0,podRecreated:false};
  root.innerHTML=`
    <div class="panel">
      <div class="eyebrow">Ephemeral vs persistent data</div><h2 style="margin-top:8px">A volume is mounted into a Pod. Persistence depends on the volume type.</h2>
      <p class="hero-copy">Some volumes live only as long as the Pod; others point at storage with an independent lifecycle. Test both.</p>
      <div class="grid-2" style="margin-top:18px">
        <div>
          <div class="control"><label>Volume type</label><select id="kind"><option value="emptyDir">emptyDir</option><option value="configMap">ConfigMap</option><option value="pvc">PVC-backed persistent volume</option></select></div>
          <div class="chip-row"><button class="chip-btn" id="write">Write /data/hello.txt</button><button class="chip-btn" id="restart">Restart container</button><button class="chip-btn" id="recreate">Delete & recreate Pod</button></div>
          <div id="state" class="math-box"></div>
        </div>
        <div id="visual"></div>
      </div>
    </div>

    <div class="grid-3" style="margin-top:14px">
      <div class="callout success" style="margin:0"><strong>emptyDir</strong><p>Created for the Pod. It survives container restarts inside that Pod but is deleted when the Pod is removed.</p></div>
      <div class="callout" style="margin:0"><strong>ConfigMap volume</strong><p>Projects configuration data into the filesystem; it is not general-purpose writable application storage.</p></div>
      <div class="callout warn" style="margin:0"><strong>PVC-backed volume</strong><p>The Pod mounts storage claimed through a PVC; the storage lifecycle is decoupled from a single Pod.</p></div>
    </div>

    <div class="panel" style="margin-top:14px"><div class="eyebrow">Challenge</div><h3 style="margin-top:7px">Which action proves the difference between container lifetime and Pod lifetime for <code>emptyDir</code>?</h3><p style="color:var(--muted)">Write a file, restart the container, then recreate the Pod.</p><button class="primary-btn" data-mark-complete>Mark lesson complete</button></div>`;
  const q=s=>root.querySelector(s);let hasData=false;
  function render(){
    const persistsContainer=state.kind!=='configMap';
    const persistsPod=state.kind==='pvc';
    q('#state').textContent=`volume=${state.kind}\nfile=${hasData?'present':'missing'}\ncontainer restarts=${state.restart}\npod recreated=${state.podRecreated?'yes':'no'}`;
    q('#visual').innerHTML=`<div class="flow"><div class="flow-step"><strong>1. Pod</strong><small>mount /data</small></div><div class="flow-step"><strong>2. ${state.kind}</strong><small>${state.kind==='pvc'?'independent storage':state.kind==='emptyDir'?'Pod-scoped':'projected config'}</small></div><div class="flow-step"><strong>3. file</strong><small>${hasData?'✓ exists':'✕ absent'}</small></div></div><div class="callout ${hasData?'success':'warn'}"><strong>${state.kind==='pvc'?'Persistent across Pod replacement':state.kind==='emptyDir'?'Survives container restart, not Pod deletion':'Configuration projection'}</strong><p>${state.kind==='emptyDir'?'The key boundary is the Pod lifecycle.':state.kind==='pvc'?'A replacement Pod can mount the same claim, subject to access mode and scheduling/storage constraints.':'Treat ConfigMap as configuration input, not durable application data.'}</p></div>`;
  }
  const bind=(sel,ev,fn)=>{const el=q(sel);el.addEventListener(ev,fn);cleanup.push(()=>el.removeEventListener(ev,fn));};
  bind('#kind','change',e=>{state.kind=e.target.value;hasData=false;state.restart=0;state.podRecreated=false;render();});
  bind('#write','click',()=>{hasData=state.kind!=='configMap';render();});
  bind('#restart','click',()=>{state.restart++; if(state.kind==='configMap')hasData=false; render();});
  bind('#recreate','click',()=>{state.podRecreated=true;if(state.kind!=='pvc')hasData=false;render();});
  bind('[data-mark-complete]','click',markComplete);render();
}
export function unmount(){cleanup.forEach(fn=>{try{fn();}catch{}});cleanup=[];}
