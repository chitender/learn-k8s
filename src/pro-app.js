import { signUp, confirmSignUp, signIn, signOut, session, api } from './auth-client.js';

const root = document.querySelector('#pro-app');
const cfg = window.LEARN_K8S_CONFIG || {};
let entitlements = null;
let activeSession = null;

const products = [
  { id:'ckad_attempt', title:'CKAD Exam Simulator', subtitle:'2-hour application developer exam environment', price:'₹999', exam:'CKAD' },
  { id:'cks_attempt', title:'CKS Exam Simulator', subtitle:'2-hour security specialist exam environment', price:'₹1,299', exam:'CKS' }
];

function nav(){
  return `<div class="pro-nav"><a class="brand" href="./index.html"><span class="brand-mark">⎈</span><span>Learn Kubernetes<small>Pro Exam Simulator</small></span></a><div class="chip-row"><a class="ghost-btn" href="./index.html">Free labs</a>${session()?'<button class="ghost-btn" id="logout">Sign out</button>':''}</div></div>`;
}

function render(){
  const user = session();
  root.innerHTML = `<div class="pro-shell">${nav()}<main class="pro-main">
    <section class="pro-hero">
      <div class="pro-card"><div class="eyebrow">Performance-based practice</div><h1>Train like the real Kubernetes exam.</h1><p class="hero-copy">Timed CKAD and CKS attempts with an isolated Kubernetes environment, task list, browser terminal and automatic session expiry.</p><div class="callout warn"><strong>Launch safety</strong><p>Checkout stays disabled until the AWS live-lab engine and Razorpay live-mode webhooks are verified.</p></div></div>
      <div class="pro-card"><div class="eyebrow">Account</div>${user?`<h2>${user.email}</h2><div class="pro-status"><span class="badge">CKAD credits: ${entitlements?.ckad_credits??0}</span><span class="badge">CKS credits: ${entitlements?.cks_credits??0}</span></div>`:'<h2>Sign in to purchase and launch attempts.</h2>'}</div>
    </section>
    <section class="pro-price-grid">${products.map(product=>`<article class="pro-card"><div class="eyebrow">${product.exam}</div><h2>${product.title}</h2><p>${product.subtitle}</p><div class="pro-price">${product.price}</div><button class="primary-btn buy" data-product="${product.id}" ${!cfg.paidExamsEnabled?'disabled':''}>${cfg.paidExamsEnabled?'Buy attempt':'Payments not live yet'}</button> <button class="chip-btn start" data-exam="${product.exam}" ${!user?'disabled':''}>Start with credit</button></article>`).join('')}</section>
    ${user?'':authPanel()}
    <div id="pro-message"></div>
    <div id="exam-host"></div>
  </main></div>`;
  bind();
}

function authPanel(){
  return `<section class="pro-auth">
    <div class="pro-card"><h3>Sign in</h3><input id="login-email" type="email" placeholder="Email"><input id="login-password" type="password" placeholder="Password"><button class="primary-btn" id="login">Sign in</button></div>
    <div class="pro-card"><h3>Create account</h3><input id="signup-email" type="email" placeholder="Email"><input id="signup-password" type="password" placeholder="Password (8+ chars)"><button class="primary-btn" id="signup">Create account</button><div style="margin-top:10px"><input id="confirm-code" placeholder="Verification code"><button class="chip-btn" id="confirm">Verify email</button></div></div>
  </section>`;
}

function msg(text,type='success'){ const el=document.querySelector('#pro-message'); if(el) el.innerHTML=`<div class="callout ${type}" style="margin-top:16px"><strong>${text}</strong></div>`; }

async function refreshEntitlements(){
  if (!session()) { entitlements=null; return; }
  try { entitlements=await api('/me/entitlements'); } catch(error){ msg(error.message,'danger'); }
}

async function buy(productId){
  if(!session()) return msg('Sign in before purchasing.','warn');
  if(!cfg.paidExamsEnabled) return msg('Paid exams are not enabled yet.','warn');
  const order=await api('/payments/order',{method:'POST',body:JSON.stringify({product_id:productId})});
  const checkout = new Razorpay({
    key:cfg.razorpayKeyId,
    amount:order.amount,
    currency:order.currency,
    order_id:order.order_id,
    name:'Learn Kubernetes Pro',
    description:order.product_name,
    handler:async response=>{
      await api('/payments/verify',{method:'POST',body:JSON.stringify(response)});
      await refreshEntitlements(); render(); msg('Payment verified. Your exam credit is ready.');
    }
  });
  checkout.open();
}

async function startExam(exam){
  const result=await api('/exams/start',{method:'POST',body:JSON.stringify({exam_type:exam})});
  activeSession=result;
  renderExam(result);
  if(result.status==='provisioning') pollSession(result.session_id);
}

async function pollSession(sessionId){
  for(let i=0;i<48;i++){
    await new Promise(resolve=>setTimeout(resolve,5000));
    const result=await api(`/exams/session/${sessionId}`);
    activeSession=result;
    renderExam(result);
    if(result.status!=='provisioning') return;
  }
  msg('The lab is still provisioning. You can retry from this page shortly.','warn');
}

async function submitExam(sessionId){
  if(!window.confirm('Submit this exam now? The live worker will be terminated and you cannot continue editing the cluster.')) return;
  const result=await api(`/exams/session/${sessionId}/submit`,{method:'POST',body:'{}'});
  activeSession=null;
  const host=document.querySelector('#exam-host');
  if(host) host.innerHTML=`<section class="pro-card" style="margin-top:24px"><div class="eyebrow">Attempt submitted</div><h2>Score: ${result.score}/${result.max_score}</h2><div class="exam-tasks">${result.results.map(r=>`<div class="exam-task"><strong>${r.passed?'✓':'✗'} ${r.title}</strong><br><small>${r.weight}%</small></div>`).join('')}</div></section>`;
}

function renderExam(exam){
  const host=document.querySelector('#exam-host'); if(!host) return;
  const expires = exam.expires_at ? new Date(exam.expires_at*1000).toLocaleTimeString() : '';
  host.innerHTML=`<section class="pro-card" style="margin-top:24px"><div class="section-head"><div><div class="eyebrow">${exam.exam_type} attempt</div><h2>Exam cockpit</h2></div><span class="badge">${exam.status}</span></div><div class="callout"><strong>Original practice tasks</strong><p>These tasks are written for Learn Kubernetes from the public CNCF domains; they are not copied from the live certification exam.</p></div><div class="exam-cockpit"><div class="exam-tasks">${(exam.tasks||[]).map((task,i)=>`<button class="exam-task" data-task-index="${i}"><strong>${i+1}. ${task.title}</strong><br><small>${task.weight}%</small><p>${task.prompt||''}</p></button>`).join('')}</div><div class="exam-terminal"><div class="cyan">Session: ${exam.session_id}</div><div>Expires: ${expires}</div><div>Time limit: 120 minutes</div><br>${exam.terminal_url?`<div class="green">Lab ready</div><p>Terminal login: <strong>${exam.terminal_username}</strong> / <strong>${exam.terminal_password}</strong></p><a class="primary-btn" target="_blank" rel="noreferrer" href="${exam.terminal_url}">Open live terminal ↗</a><button class="danger-btn" id="submit-exam" style="margin-left:8px">Submit & grade</button>`:'<div class="amber">Lab is provisioning. This page checks readiness automatically.</div>'}</div></div></section>`;
  document.querySelector('#submit-exam')?.addEventListener('click',()=>submitExam(exam.session_id).catch(e=>msg(e.message,'danger')));
}

function bind(){
  document.querySelector('#logout')?.addEventListener('click',()=>{signOut();entitlements=null;render();});
  document.querySelector('#login')?.addEventListener('click',async()=>{try{await signIn(document.querySelector('#login-email').value,document.querySelector('#login-password').value);await refreshEntitlements();render();}catch(e){msg(e.message,'danger');}});
  document.querySelector('#signup')?.addEventListener('click',async()=>{try{await signUp(document.querySelector('#signup-email').value,document.querySelector('#signup-password').value);msg('Verification code sent to your email.');}catch(e){msg(e.message,'danger');}});
  document.querySelector('#confirm')?.addEventListener('click',async()=>{try{await confirmSignUp(document.querySelector('#signup-email').value,document.querySelector('#confirm-code').value);msg('Email verified. You can sign in now.');}catch(e){msg(e.message,'danger');}});
  document.querySelectorAll('.buy').forEach(b=>b.addEventListener('click',()=>buy(b.dataset.product).catch(e=>msg(e.message,'danger'))));
  document.querySelectorAll('.start').forEach(b=>b.addEventListener('click',()=>startExam(b.dataset.exam).catch(e=>msg(e.message,'danger'))));
}

await refreshEntitlements();
render();
if(activeSession) renderExam(activeSession);
