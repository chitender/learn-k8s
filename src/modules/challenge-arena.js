import { CHALLENGES, CHALLENGE_DOMAINS } from '../data/challenges.js';

let cleanup = [];

export function mount(root, { markComplete, awardXP }) {
  const state = { track:'All', difficulty:'All', domain:'All', index:0, score:0, attempts:0, answered:false };
  root.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <div class="eyebrow">Challenge mode</div><h2>CKA / SRE Arena</h2>
        <p class="hero-copy">Choose a track, domain and difficulty. Make the diagnosis first, then read the mechanism. Correct first-time solves earn bonus XP.</p>
        <div class="grid-3">
          <div class="control"><label>Track</label><select id="track"><option>All</option><option>CKA</option><option>SRE</option></select></div>
          <div class="control"><label>Domain</label><select id="domain"><option>All</option>${CHALLENGE_DOMAINS.map(domain => `<option>${domain}</option>`).join('')}</select></div>
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
        <div class="callout warn"><strong>Bonus XP is one-time per question</strong><p>Replaying is encouraged for learning, but the same solved question only awards bonus XP once.</p></div>
      </div>
    </div>
    <div class="quiz-card" style="margin-top:16px">
      <div class="card-top"><div class="chip-row"><span class="badge" id="tag"></span><span class="badge" id="domain-tag"></span></div><span class="badge" id="stars"></span></div>
      <h2 id="prompt"></h2>
      <div id="options" class="quiz-options" style="margin-top:18px"></div>
      <div id="feedback" class="callout"></div>
      <div class="chip-row" style="margin-top:14px"><button class="primary-btn" id="next">Next challenge →</button><button class="chip-btn" id="random">Random challenge</button></div>
    </div>
    <div class="panel" style="margin-top:14px"><button class="primary-btn" data-mark-complete>Mark arena complete</button></div>`;

  const $ = s => root.querySelector(s);
  let streak = 0;

  function pool() {
    return CHALLENGES.filter(q =>
      (state.track === 'All' || q.track === state.track) &&
      (state.domain === 'All' || q.domain === state.domain) &&
      (state.difficulty === 'All' || q.difficulty === Number(state.difficulty))
    );
  }

  function current() {
    const list = pool();
    if (!list.length) return CHALLENGES[0];
    state.index %= list.length;
    return list[state.index];
  }

  function render() {
    const list = pool();
    const q = current();
    $('#pool').textContent = list.length;
    $('#score').textContent = `${state.score}/${state.attempts}`;
    $('#streak').textContent = streak;
    $('#tag').textContent = q.track;
    $('#domain-tag').textContent = q.domain;
    $('#stars').textContent = '★'.repeat(q.difficulty);
    $('#prompt').textContent = q.prompt;
    $('#options').innerHTML = q.choices.map((choice,i)=>`<button class="lesson-card arena-option" data-index="${i}" style="min-height:auto"><h3>${String.fromCharCode(65+i)}. ${choice}</h3></button>`).join('');
    $('#feedback').className = 'callout';
    $('#feedback').innerHTML = '<strong>Pick an answer</strong><p>Try to explain why before clicking.</p>';
    state.answered = false;
    root.querySelectorAll('.arena-option').forEach(btn => {
      btn.addEventListener('click', answer);
      cleanup.push(()=>btn.removeEventListener('click',answer));
    });
  }

  function answer(e) {
    if (state.answered) return;
    state.answered = true;
    const q = current();
    const selected = Number(e.currentTarget.dataset.index);
    const ok = selected === q.answer;
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

  function filters() {
    state.track = $('#track').value;
    state.domain = $('#domain').value;
    state.difficulty = $('#difficulty').value;
    state.index = 0;
    render();
  }

  ['#track','#domain','#difficulty'].forEach(sel => {
    $(sel).addEventListener('input', filters);
    cleanup.push(()=>$(sel)?.removeEventListener('input',filters));
  });

  const next = () => { state.index++; render(); };
  const random = () => {
    const list = pool();
    state.index = Math.floor(Math.random() * Math.max(1,list.length));
    render();
  };
  $('#next').addEventListener('click',next);
  $('#random').addEventListener('click',random);
  cleanup.push(()=>$('#next')?.removeEventListener('click',next),()=>$('#random')?.removeEventListener('click',random));

  const done = () => markComplete();
  root.querySelector('[data-mark-complete]').addEventListener('click',done);
  cleanup.push(()=>root.querySelector('[data-mark-complete]')?.removeEventListener('click',done));
  render();
}

export function unmount(){ cleanup.forEach(fn=>{try{fn()}catch{}}); cleanup=[]; }
