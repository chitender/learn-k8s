let cleanup = [];

const QUESTIONS = [
  { id:'cka-pending', track:'CKA', difficulty:1, prompt:'A Pod is Pending. Nodes show low live CPU, but Events say “Insufficient cpu”. What should you trust for scheduler fit?', choices:['Live node CPU %','CPU requests already allocated on nodes','Container CPU limits','HPA target utilization'], answer:1, why:'The scheduler checks requested resources against allocatable capacity; low instantaneous utilization does not create scheduler headroom.' },
  { id:'cka-service', track:'CKA', difficulty:1, prompt:'A Service exists but has no Ready endpoints. What happens to client traffic?', choices:['kube-proxy creates a Pod','The Service IP disappears','There is no healthy backend to forward to','DNS deletes the Service record'], answer:2, why:'The stable Service can exist while EndpointSlices contain no Ready backend endpoints.' },
  { id:'cka-probe', track:'CKA', difficulty:1, prompt:'Which probe should normally remove a Pod from Service traffic without restarting the container?', choices:['startupProbe','readinessProbe','livenessProbe','exec lifecycle hook'], answer:1, why:'Readiness controls traffic eligibility. Liveness is about restarting an unhealthy container.' },
  { id:'cka-pvc', track:'CKA', difficulty:2, prompt:'PVC is Bound, but the Pod reports FailedMount / NodePublishVolume. Which boundary is most suspicious?', choices:['Scheduler Filter plugin','CSI node-side mount path','CoreDNS','HPA controller'], answer:1, why:'Bound proves claim/PV binding. It does not prove the CSI node plugin successfully staged or mounted the volume.' },
  { id:'cka-rbac', track:'CKA', difficulty:2, prompt:'A ServiceAccount token authenticates successfully, but the API returns 403. What failed?', choices:['Authentication','Authorization/RBAC','Admission mutation','etcd compaction'], answer:1, why:'401 points toward authentication. 403 means identity is known but the requested action is not authorized.' },
  { id:'sre-throttle', track:'SRE', difficulty:2, prompt:'Node CPU is 35%, Pod latency spikes, and cpu.stat nr_throttled rises quickly. Best diagnosis?', choices:['Scheduler starvation','CPU cgroup throttling','CoreDNS overload','PVC attach failure'], answer:1, why:'A container CPU limit can throttle the cgroup even while the node still has idle CPU.' },
  { id:'sre-cni', track:'SRE', difficulty:2, prompt:'Same-node Pod traffic works, cross-node Pod IP traffic times out, and Services are healthy. First subsystem to investigate?', choices:['CNI/node dataplane','Deployment controller','etcd storage','Admission webhook'], answer:0, why:'The failure boundary is cross-node Pod networking, which points toward CNI, routes, tunnels, eBPF/netfilter or node dataplane.' },
  { id:'sre-rollout', track:'SRE', difficulty:2, prompt:'A rollout stalls with new Pods Running but NotReady. Old replicas remain serving. Which mechanism is protecting availability?', choices:['PriorityClass','Readiness + Deployment rollout rules','ResourceQuota','Pod Security Admission'], answer:1, why:'Readiness prevents bad new replicas becoming endpoints while maxUnavailable/maxSurge control rollout progress.' },
  { id:'sre-etcd', track:'SRE', difficulty:3, prompt:'kube-apiserver is reachable, reads from cache sometimes work, but new object writes consistently fail because authoritative persistence is unavailable. Suspect?', choices:['kube-proxy','etcd','CNI IPAM','metrics-server'], answer:1, why:'etcd is the authoritative backing store for Kubernetes API state. Persistent writes cannot succeed without it.' },
  { id:'sre-eviction', track:'SRE', difficulty:3, prompt:'A node enters MemoryPressure. Which statement about eviction is most accurate?', choices:['PDB always prevents kubelet eviction','QoS alone completely defines victim order','Kubelet uses pressure thresholds plus usage relative to requests, priority and QoS-related behavior','CPU limits determine memory victims'], answer:2, why:'Node-pressure eviction considers whether usage exceeds requests, Pod priority, and resource usage; QoS influences behavior but is not the only signal.' }
];

export function mount(root, { markComplete, awardXP }) {
  const state = { track:'All', difficulty:'All', index:0, score:0, attempts:0, answered:false };
  root.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="eyebrow">Challenge mode</div><h2>CKA / SRE Arena</h2>
        <p class="hero-copy">Choose a track, make a diagnosis, then read the mechanism. Correct first-time solves earn bonus XP.</p>
        <div class="grid-2">
          <div class="control"><label>Track</label><select id="track"><option>All</option><option>CKA</option><option>SRE</option></select></div>
          <div class="control"><label>Difficulty</label><select id="difficulty"><option>All</option><option value="1">★</option><option value="2">★★</option><option value="3">★★★</option></select></div>
        </div>
        <div class="grid-3">
          <div class="metric"><span>Score</span><strong id="score">0/0</strong></div>
          <div class="metric"><span>Current streak</span><strong id="streak">0</strong></div>
          <div class="metric"><span>Question pool</span><strong id="pool">0</strong></div>
        </div>
      </div>
      <div class="panel">
        <div class="eyebrow">How to use it</div>
        <div class="callout success"><strong>Think in failure boundaries</strong><p>Scheduler? API/control plane? kubelet/runtime? network? storage? application health? Start with the symptom and pick the narrowest subsystem.</p></div>
        <div class="callout warn"><strong>Bonus XP is one-time per question</strong><p>Replaying is encouraged for learning, but refresh-spamming the same answer will not farm XP.</p></div>
      </div>
    </div>
    <div class="quiz-card" style="margin-top:16px">
      <div class="card-top"><span class="badge" id="tag"></span><span class="badge" id="stars"></span></div>
      <h2 id="prompt"></h2>
      <div id="options" class="quiz-options" style="margin-top:18px"></div>
      <div id="feedback" class="callout"></div>
      <div class="chip-row" style="margin-top:14px"><button class="primary-btn" id="next">Next challenge →</button><button class="chip-btn" id="random">Random challenge</button></div>
    </div>
    <div class="panel" style="margin-top:14px"><button class="primary-btn" data-mark-complete>Mark arena complete</button></div>`;

  const $ = s => root.querySelector(s);
  let streak = 0;
  function pool() {
    return QUESTIONS.filter(q => (state.track === 'All' || q.track === state.track) && (state.difficulty === 'All' || q.difficulty === Number(state.difficulty)));
  }
  function current() {
    const list = pool();
    if (!list.length) return QUESTIONS[0];
    state.index %= list.length;
    return list[state.index];
  }
  function render() {
    const list = pool(), q = current();
    $('#pool').textContent = list.length;
    $('#score').textContent = `${state.score}/${state.attempts}`;
    $('#streak').textContent = streak;
    $('#tag').textContent = q.track;
    $('#stars').textContent = '★'.repeat(q.difficulty);
    $('#prompt').textContent = q.prompt;
    $('#options').innerHTML = q.choices.map((choice,i)=>`<button class="lesson-card arena-option" data-index="${i}" style="min-height:auto"><h3>${String.fromCharCode(65+i)}. ${choice}</h3></button>`).join('');
    $('#feedback').className = 'callout';
    $('#feedback').innerHTML = '<strong>Pick an answer</strong><p>Try to explain why before clicking.</p>';
    state.answered = false;
    root.querySelectorAll('.arena-option').forEach(btn => { btn.addEventListener('click', answer); cleanup.push(()=>btn.removeEventListener('click',answer)); });
  }
  function answer(e) {
    if (state.answered) return;
    state.answered = true;
    const q = current(), selected = Number(e.currentTarget.dataset.index), ok = selected === q.answer;
    state.attempts++;
    if (ok) { state.score++; streak++; } else streak = 0;
    let bonus = '';
    if (ok && awardXP) {
      const result = awardXP(`arena:${q.id}`, 25 * q.difficulty);
      if (result?.awarded) bonus = ` +${result.awarded} bonus XP`;
    }
    $('#score').textContent = `${state.score}/${state.attempts}`;
    $('#streak').textContent = streak;
    $('#feedback').className = `callout ${ok ? 'success' : 'danger'}`;
    $('#feedback').innerHTML = `<strong>${ok ? `Correct${bonus}` : `Answer: ${q.choices[q.answer]}`}</strong><p>${q.why}</p>`;
  }
  function filters() { state.track=$('#track').value; state.difficulty=$('#difficulty').value; state.index=0; render(); }
  $('#track').addEventListener('input',filters); $('#difficulty').addEventListener('input',filters);
  cleanup.push(()=>$('#track')?.removeEventListener('input',filters),()=>$('#difficulty')?.removeEventListener('input',filters));
  const next=()=>{state.index++;render();}; const random=()=>{const list=pool();state.index=Math.floor(Math.random()*Math.max(1,list.length));render();};
  $('#next').addEventListener('click',next); $('#random').addEventListener('click',random);
  cleanup.push(()=>$('#next')?.removeEventListener('click',next),()=>$('#random')?.removeEventListener('click',random));
  const done=()=>markComplete(); root.querySelector('[data-mark-complete]').addEventListener('click',done); cleanup.push(()=>root.querySelector('[data-mark-complete]')?.removeEventListener('click',done));
  render();
}

export function unmount(){ cleanup.forEach(fn=>{try{fn()}catch{}}); cleanup=[]; }
