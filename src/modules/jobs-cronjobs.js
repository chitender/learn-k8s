let cleanup=[];
export function mount(root,{markComplete}){
 const state={completions:5,parallelism:2,succeeded:0,failed:0,active:0,tick:0,policy:'Forbid'};
 root.innerHTML=`<div class="grid-2"><div class="panel"><div class="eyebrow">Finite work simulator</div><h2>Job controller</h2>
 <div class="control"><label>Completions <span id="comp-v"></span></label><input id="comp" type="range" min="1" max="10" value="5"></div>
 <div class="control"><label>Parallelism <span id="par-v"></span></label><input id="par" type="range" min="1" max="5" value="2"></div>
 <div class="chip-row"><button class="primary-btn" id="run">Run one controller step</button><button class="chip-btn" id="fail">Fail one active Pod</button><button class="chip-btn" id="reset">Reset</button></div>
 <div class="grid-3" style="margin-top:14px"><div class="metric"><span>Succeeded</span><strong id="succeeded"></strong></div><div class="metric"><span>Active</span><strong id="active"></strong></div><div class="metric"><span>Failed</span><strong id="failed"></strong></div></div></div>
 <div class="panel"><div class="eyebrow">Recurring work</div><h2>CronJob</h2><p style="color:var(--muted)">A CronJob creates Jobs on a schedule. It does not turn a long-running server into a cron process.</p>
 <div class="control"><label>concurrencyPolicy</label><select id="policy"><option>Allow</option><option selected>Forbid</option><option>Replace</option></select></div><button class="primary-btn" id="cron">Fire next schedule tick</button><div id="cron-result" style="margin-top:12px"></div></div></div>
 <div class="callout" style="margin-top:14px"><strong>Mental model</strong><p>Deployment: keep N replicas running. Job: finish N successful tasks. CronJob: periodically create Jobs.</p></div><div class="panel" style="margin-top:14px"><button class="primary-btn" data-mark-complete>Mark lesson complete</button></div>`;
 const $=s=>root.querySelector(s);
 function render(){state.active=Math.min(state.parallelism,Math.max(0,state.completions-state.succeeded));$('#comp-v').textContent=state.completions;$('#par-v').textContent=state.parallelism;$('#succeeded').textContent=`${state.succeeded}/${state.completions}`;$('#active').textContent=state.active;$('#failed').textContent=state.failed;}
 const run=()=>{if(state.succeeded<state.completions){const finish=Math.min(state.parallelism,state.completions-state.succeeded);state.succeeded+=finish;}render()};$('#run').addEventListener('click',run);cleanup.push(()=>$('#run').removeEventListener('click',run));
 const fail=()=>{if(state.active>0)state.failed++;render()};$('#fail').addEventListener('click',fail);cleanup.push(()=>$('#fail').removeEventListener('click',fail));
 const reset=()=>{state.succeeded=0;state.failed=0;render()};$('#reset').addEventListener('click',reset);cleanup.push(()=>$('#reset').removeEventListener('click',reset));
 [['#comp','completions'],['#par','parallelism']].forEach(([s,k])=>{const el=$(s),fn=()=>{state[k]=Number(el.value);state.succeeded=Math.min(state.succeeded,state.completions);render()};el.addEventListener('input',fn);cleanup.push(()=>el.removeEventListener('input',fn))});
 const pol=$('#policy');const pf=()=>state.policy=pol.value;pol.addEventListener('change',pf);cleanup.push(()=>pol.removeEventListener('change',pf));
 const cron=()=>{state.tick++;const active=state.tick%2===0;let msg='new Job created';if(active&&state.policy==='Forbid')msg='schedule skipped because previous Job is still active';if(active&&state.policy==='Replace')msg='active Job replaced by a new Job';if(active&&state.policy==='Allow')msg='another Job created concurrently';$('#cron-result').innerHTML=`<div class="callout ${msg.includes('skipped')?'warn':'success'}"><strong>Tick ${state.tick}</strong><p>${msg}.</p></div>`};$('#cron').addEventListener('click',cron);cleanup.push(()=>$('#cron').removeEventListener('click',cron));
 const done=()=>markComplete();root.querySelector('[data-mark-complete]').addEventListener('click',done);cleanup.push(()=>root.querySelector('[data-mark-complete]')?.removeEventListener('click',done));render();}
export function unmount(){cleanup.forEach(fn=>{try{fn()}catch{}});cleanup=[];}
