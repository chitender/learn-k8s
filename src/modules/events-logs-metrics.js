let cleanup=[];

export function mount(root,{markComplete}){
  const scenarios={
    pending:{title:'Pod is Pending',first:'events',events:['FailedScheduling: 0/3 nodes are available: 3 Insufficient cpu'],logs:['No container logs yet — the container never started.'],metrics:['Node CPU live usage: 22%','Requested CPU on nodes: 92%']},
    crash:{title:'Pod is CrashLoopBackOff',first:'logs',events:['BackOff: restarting failed container'],logs:['FATAL: cannot connect to db:5432','process exited with code 1'],metrics:['Restarts: 17','CPU: low between crashes']},
    latency:{title:'Service latency is high',first:'metrics',events:['No recent warning events'],logs:['200 GET /api 2.8s','200 GET /api 3.1s'],metrics:['p95 latency: 3.0s','CPU throttling ratio: 38%','CPU usage near limit']}
  };
  let current='pending';
  root.innerHTML=`
    <div class="panel">
      <div class="eyebrow">Evidence, not guessing</div><h2 style="margin-top:8px">Events explain transitions. Logs explain app behavior. Metrics explain trends.</h2>
      <p class="hero-copy">Pick a symptom and decide which signal gives the fastest first clue. Then inspect all three to build the full story.</p>
      <div class="chip-row" id="scenarios" style="margin:16px 0"></div>
      <div class="grid-3">
        <button class="panel signal" data-signal="events" style="text-align:left;cursor:pointer"><div class="eyebrow">Events</div><h3 style="margin-top:7px">What changed?</h3><p style="color:var(--muted);font-size:13px">Scheduling failures, probe failures, image pulls, mounts and controller/node transitions.</p></button>
        <button class="panel signal" data-signal="logs" style="text-align:left;cursor:pointer"><div class="eyebrow">Logs</div><h3 style="margin-top:7px">What did the process say?</h3><p style="color:var(--muted);font-size:13px">Application stdout/stderr and previous-container output.</p></button>
        <button class="panel signal" data-signal="metrics" style="text-align:left;cursor:pointer"><div class="eyebrow">Metrics</div><h3 style="margin-top:7px">What is changing over time?</h3><p style="color:var(--muted);font-size:13px">CPU, memory, latency, saturation, restarts and throttling trends.</p></button>
      </div>
      <div id="console" class="terminal" style="margin-top:14px;min-height:180px"></div>
      <div id="hint"></div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="eyebrow">Repeatable production habit</div>
      <div class="flow" style="margin-top:12px">${['State','Events','Logs','Metrics','Dependencies','Hypothesis'].map((x,i)=>`<div class="flow-step"><strong>${i+1}. ${x}</strong><small>${['kubectl get/describe','why state changed','what process did','trend & saturation','Service/DNS/storage','test, don\'t guess'][i]}</small></div>`).join('')}</div>
      <div class="math-box">kubectl get pod -o wide\nkubectl describe pod &lt;pod&gt;\nkubectl logs &lt;pod&gt; --previous\nkubectl top pod / node\n# then follow the dependency path</div>
      <button class="primary-btn" data-mark-complete style="margin-top:14px">Mark lesson complete</button>
    </div>`;
  const q=s=>root.querySelector(s);
  function renderScenario(){
    const s=scenarios[current];
    q('#scenarios').innerHTML=Object.entries(scenarios).map(([id,v])=>`<button class="chip-btn ${id===current?'active':''}" data-scenario="${id}">${v.title}</button>`).join('');
    root.querySelectorAll('[data-scenario]').forEach(b=>{const fn=()=>{current=b.dataset.scenario;renderScenario();show(scenarios[current].first);};b.addEventListener('click',fn);cleanup.push(()=>b.removeEventListener('click',fn));});
    show(s.first);
  }
  function show(signal){
    const s=scenarios[current];
    const commands={events:'kubectl describe pod / kubectl get events',logs:'kubectl logs --previous',metrics:'kubectl top + monitoring metrics'};
    q('#console').innerHTML=`<div><span class="green">$</span> ${commands[signal]}</div><br>${s[signal].map(line=>`<div>${line}</div>`).join('')}`;
    q('#hint').innerHTML=signal===s.first?`<div class="callout success"><strong>Good first signal for this symptom.</strong><p>Still correlate with the other signals before declaring root cause.</p></div>`:`<div class="callout warn"><strong>Useful, but not the fastest first clue.</strong><p>For <em>${s.title}</em>, start with <strong>${s.first}</strong>, then correlate.</p></div>`;
  }
  root.querySelectorAll('.signal').forEach(b=>{const fn=()=>show(b.dataset.signal);b.addEventListener('click',fn);cleanup.push(()=>b.removeEventListener('click',fn));});
  const done=q('[data-mark-complete]');done.addEventListener('click',markComplete);cleanup.push(()=>done.removeEventListener('click',markComplete));renderScenario();
}
export function unmount(){cleanup.forEach(fn=>{try{fn();}catch{}});cleanup=[];}
