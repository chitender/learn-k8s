let cleanup=[];
export function mount(root,{markComplete}){
 const state={identity:'alice',namespace:'dev',verb:'get',resource:'pods'};
 const rules={alice:[['dev','get','pods'],['dev','list','pods'],['dev','create','deployments'],['prod','get','pods'],['prod','list','pods']],deployer:[['dev','create','deployments'],['dev','update','deployments'],['dev','get','pods']],clusterops:[['*','*','*']]};
 root.innerHTML=`<div class="grid-2"><div class="panel"><div class="eyebrow">Authorization playground</div><h2>Who can do what, where?</h2>
 <div class="control"><label>Identity</label><select id="identity"><option value="alice">alice (human)</option><option value="deployer">system:serviceaccount:dev:deployer</option><option value="clusterops">cluster-ops</option></select></div>
 <div class="control"><label>Namespace</label><select id="ns"><option>dev</option><option>prod</option></select></div>
 <div class="control"><label>Verb</label><select id="verb"><option>get</option><option>list</option><option>create</option><option>update</option><option>delete</option></select></div>
 <div class="control"><label>Resource</label><select id="resource"><option>pods</option><option>deployments</option><option>secrets</option></select></div></div>
 <div class="panel"><div class="eyebrow">RBAC decision</div><div id="decision"></div><div class="terminal" id="auth" style="margin-top:14px"></div></div></div>
 <div class="grid-3" style="margin-top:14px"><div class="metric"><span>Namespace</span><strong>Scope, not a security boundary by itself</strong><p style="color:var(--muted);font-size:12px">Many objects are namespaced; Nodes, PVs and StorageClasses are cluster-scoped.</p></div><div class="metric"><span>Role + RoleBinding</span><strong>Namespace-scoped access</strong><p style="color:var(--muted);font-size:12px">Prefer this for least privilege when cluster-wide access is unnecessary.</p></div><div class="metric"><span>ClusterRole</span><strong>Reusable or cluster-wide rules</strong><p style="color:var(--muted);font-size:12px">Binding determines whether its permissions apply in one namespace or across the cluster.</p></div></div>
 <div class="panel" style="margin-top:14px"><button class="primary-btn" data-mark-complete>Mark lesson complete</button></div>`;
 const $=s=>root.querySelector(s);
 function allowed(){return rules[state.identity].some(([n,v,r])=>(n==='*'||n===state.namespace)&&(v==='*'||v===state.verb)&&(r==='*'||r===state.resource));}
 function render(){const ok=allowed();$('#decision').innerHTML=`<div class="callout ${ok?'success':'danger'}"><strong>${ok?'ALLOWED':'DENIED'}</strong><p>${state.identity} → ${state.verb} ${state.resource} in namespace ${state.namespace}. ${ok?'A matching RBAC rule exists.':'No matching rule exists; RBAC is deny-by-default.'}</p></div>`;$('#auth').textContent=`$ kubectl auth can-i ${state.verb} ${state.resource} -n ${state.namespace} --as=${state.identity==='deployer'?'system:serviceaccount:dev:deployer':state.identity}\n${ok?'yes':'no'}`;}
 [['#identity','identity'],['#ns','namespace'],['#verb','verb'],['#resource','resource']].forEach(([s,k])=>{const el=$(s),fn=()=>{state[k]=el.value;render()};el.addEventListener('change',fn);cleanup.push(()=>el.removeEventListener('change',fn))});
 const done=()=>markComplete();root.querySelector('[data-mark-complete]').addEventListener('click',done);cleanup.push(()=>root.querySelector('[data-mark-complete]')?.removeEventListener('click',done));render();
}
export function unmount(){cleanup.forEach(fn=>{try{fn()}catch{}});cleanup=[];}
