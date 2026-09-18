import {
  api,
  confirmSignUp,
  session,
  signIn,
  signOut,
  signUp
} from './auth-client.js';

const root = document.querySelector('#pro-app');
const cfg = window.LEARN_K8S_CONFIG || {};

let entitlements = null;
let activeSession = null;
let plans = [
  { id:'free', name:'Free', credits:2, price_display:'Free', purchasable:false },
  { id:'bronze', name:'Bronze', credits:5, price_display:'₹699', purchasable:false },
  { id:'silver', name:'Silver', credits:10, price_display:'₹1,379', purchasable:false },
  { id:'gold', name:'Gold', credits:20, price_display:'₹2,699', purchasable:false }
];
let catalogs = [];

function nav() {
  return `<div class="pro-nav">
    <a class="brand" href="./index.html">
      <span class="brand-mark">⎈</span>
      <span>Learn Kubernetes<small>Pro Exam Simulator</small></span>
    </a>
    <div class="chip-row">
      <a class="ghost-btn" href="./index.html">Free labs</a>
      ${session() ? '<button class="ghost-btn" id="logout">Sign out</button>' : ''}
    </div>
  </div>`;
}

function planCard(plan) {
  const perAttempt = plan.amount && plan.credits
    ? `₹${Math.round((plan.amount / 100) / plan.credits)} / credit`
    : '2 trial credits';

  let action = '<span class="badge">Included on signup</span>';
  if (plan.id !== 'free') {
    action = `<button class="primary-btn buy" data-product="${plan.id}" ${!plan.purchasable ? 'disabled' : ''}>
      ${plan.purchasable ? `Buy ${plan.credits} credits` : 'Payments not live yet'}
    </button>`;
  }

  return `<article class="pro-card">
    <div class="eyebrow">${plan.name}</div>
    <h2>${plan.credits} exam credits</h2>
    <div class="pro-price">${plan.price_display}</div>
    <p>${perAttempt}. Credits work across both CKAD and CKS catalogues.</p>
    ${action}
  </article>`;
}

function catalogCard(catalog) {
  const domainSummary = (catalog.domains || [])
    .map(domain => `${domain.name} ${domain.weight}%`)
    .join(' · ');

  return `<article class="pro-card">
    <div class="eyebrow">${catalog.exam_type} · ${catalog.baseline}</div>
    <h3>${catalog.title}</h3>
    <p>${domainSummary}</p>
    <button
      class="chip-btn start"
      data-exam="${catalog.exam_type}"
      data-catalog="${catalog.id}"
      ${!session() || !cfg.liveLabsEnabled ? 'disabled' : ''}
    >
      ${cfg.liveLabsEnabled ? 'Start with 1 credit' : 'Live labs not enabled yet'}
    </button>
  </article>`;
}

function authPanel() {
  return `<section class="pro-auth">
    <div class="pro-card">
      <h3>Sign in</h3>
      <input id="login-email" type="email" autocomplete="email" placeholder="Email">
      <input id="login-password" type="password" autocomplete="current-password" placeholder="Password">
      <button class="primary-btn" id="login">Sign in</button>
    </div>
    <div class="pro-card">
      <h3>Create account</h3>
      <p>Verified accounts receive 2 free simulator credits.</p>
      <input id="signup-email" type="email" autocomplete="email" placeholder="Email">
      <input id="signup-password" type="password" autocomplete="new-password" placeholder="Password (8+ chars)">
      <button class="primary-btn" id="signup">Create account</button>
      <div style="margin-top:10px">
        <input id="confirm-code" placeholder="Verification code">
        <button class="chip-btn" id="confirm">Verify email</button>
      </div>
    </div>
  </section>`;
}

function render() {
  const user = session();
  const ckad = catalogs.filter(item => item.exam_type === 'CKAD');
  const cks = catalogs.filter(item => item.exam_type === 'CKS');

  root.innerHTML = `<div class="pro-shell">
    ${nav()}
    <main class="pro-main">
      <section class="pro-hero">
        <div class="pro-card">
          <div class="eyebrow">Performance-based practice</div>
          <h1>Train in a real Kubernetes terminal.</h1>
          <p class="hero-copy">
            Two-hour CKAD and CKS practice sessions with original tasks mapped to the public Linux Foundation/CNCF curriculum,
            an isolated Kubernetes cluster, automatic grading, and strict session expiry.
          </p>
          <div class="callout warn">
            <strong>Not official exam content</strong>
            <p>The catalogues follow public domains and competencies. They do not reproduce confidential certification questions.</p>
          </div>
        </div>
        <div class="pro-card">
          <div class="eyebrow">Account</div>
          ${user
            ? `<h2>${user.email}</h2>
               <div class="pro-status">
                 <span class="badge">Plan: ${entitlements?.plan || 'free'}</span>
                 <span class="badge">Exam credits: ${entitlements?.exam_credits ?? 0}</span>
               </div>`
            : '<h2>Sign in to receive 2 free credits and launch attempts.</h2>'}
        </div>
      </section>

      <section style="margin-top:28px">
        <div class="section-head">
          <div>
            <div class="eyebrow">Plans</div>
            <h2>One credit = one two-hour simulator session</h2>
          </div>
        </div>
        <div class="plan-grid">${plans.map(planCard).join('')}</div>
      </section>

      ${user ? '' : authPanel()}

      <section style="margin-top:34px">
        <div class="section-head">
          <div>
            <div class="eyebrow">CKAD catalogues</div>
            <h2>Application developer practice forms</h2>
          </div>
        </div>
        <div class="pro-price-grid">
          ${ckad.length ? ckad.map(catalogCard).join('') : '<div class="pro-card">Catalogue API will appear after AWS deployment.</div>'}
        </div>
      </section>

      <section style="margin-top:34px">
        <div class="section-head">
          <div>
            <div class="eyebrow">CKS catalogues</div>
            <h2>Kubernetes security practice forms</h2>
          </div>
        </div>
        <div class="pro-price-grid">
          ${cks.length ? cks.map(catalogCard).join('') : '<div class="pro-card">Catalogue API will appear after AWS deployment.</div>'}
        </div>
      </section>

      <div id="pro-message"></div>
      <div id="exam-host"></div>
    </main>
  </div>`;

  bind();
}

function msg(text, type='success') {
  const element = document.querySelector('#pro-message');
  if (element) {
    element.innerHTML = `<div class="callout ${type}" style="margin-top:16px"><strong>${text}</strong></div>`;
  }
}

async function loadPublicData() {
  if (!cfg.apiUrl) return;
  try {
    const [planResult, catalogResult] = await Promise.all([
      api('/plans'),
      api('/exams/catalogs')
    ]);
    plans = planResult.plans || plans;
    catalogs = catalogResult.catalogs || [];
  } catch (error) {
    console.warn('Could not load Pro catalogue metadata', error);
  }
}

async function refreshEntitlements() {
  if (!session()) {
    entitlements = null;
    return;
  }
  try {
    entitlements = await api('/me/entitlements');
  } catch (error) {
    msg(error.message, 'danger');
  }
}

async function buy(productId) {
  if (!session()) return msg('Sign in before purchasing.', 'warn');

  const order = await api('/payments/order', {
    method:'POST',
    body:JSON.stringify({ product_id:productId })
  });

  const checkout = new Razorpay({
    key:order.key_id,
    amount:order.amount,
    currency:order.currency,
    order_id:order.order_id,
    name:'Learn Kubernetes Pro',
    description:`${order.product_name} · ${order.credits} exam credits`,
    handler:async payment => {
      await api('/payments/verify', {
        method:'POST',
        body:JSON.stringify(payment)
      });
      await refreshEntitlements();
      render();
      msg(`Payment verified. ${order.credits} exam credits were added.`);
      window.gtag?.('event', 'exam_plan_purchase_verified', {
        plan_id: productId,
        credits: order.credits
      });
    }
  });

  checkout.open();
  window.gtag?.('event', 'exam_checkout_started', { plan_id:productId });
}

async function startExam(examType, catalogId) {
  const result = await api('/exams/start', {
    method:'POST',
    body:JSON.stringify({
      exam_type:examType,
      catalog_id:catalogId
    })
  });

  activeSession = result;
  await refreshEntitlements();
  render();
  renderExam(result);

  window.gtag?.('event', 'exam_session_started', {
    exam_type:examType,
    catalog_id:catalogId
  });

  if (result.status === 'provisioning') {
    pollSession(result.session_id);
  }
}

async function pollSession(sessionId) {
  for (let i=0; i<48; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const result = await api(`/exams/session/${sessionId}`);
    activeSession = result;
    renderExam(result);
    if (result.status !== 'provisioning') return;
  }
  msg('The lab is still provisioning. You can retry from this page shortly.', 'warn');
}

async function submitExam(sessionId) {
  if (!window.confirm('Submit now? The live worker will be terminated and you cannot continue editing the cluster.')) return;

  const result = await api(`/exams/session/${sessionId}/submit`, {
    method:'POST',
    body:'{}'
  });

  activeSession = null;
  const host = document.querySelector('#exam-host');
  if (host) {
    host.innerHTML = `<section class="pro-card" style="margin-top:24px">
      <div class="eyebrow">Attempt submitted</div>
      <h2>Score: ${result.score}/${result.max_score}</h2>
      <div class="exam-tasks">
        ${result.results.map(item => `<div class="exam-task">
          <strong>${item.passed ? '✓' : '✗'} ${item.title}</strong><br>
          <small>${item.domain} · ${item.weight}%</small>
        </div>`).join('')}
      </div>
    </section>`;
  }

  window.gtag?.('event', 'exam_session_submitted', {
    exam_type:result.exam_type,
    catalog_id:result.catalog_id,
    score:result.score
  });
}

function renderExam(exam) {
  const host = document.querySelector('#exam-host');
  if (!host) return;

  const expires = exam.expires_at
    ? new Date(exam.expires_at * 1000).toLocaleTimeString()
    : '';

  host.innerHTML = `<section class="pro-card" style="margin-top:24px">
    <div class="section-head">
      <div>
        <div class="eyebrow">${exam.exam_type} · ${exam.catalog_id}</div>
        <h2>Exam cockpit</h2>
      </div>
      <span class="badge">${exam.status}</span>
    </div>

    <div class="callout">
      <strong>${exam.baseline || 'Kubernetes exam baseline'}</strong>
      <p>Tasks are original practice material mapped to public certification competencies.</p>
    </div>

    <div class="exam-cockpit">
      <div class="exam-tasks">
        ${(exam.tasks || []).map((task, index) => `<div class="exam-task">
          <strong>${index + 1}. ${task.title}</strong><br>
          <small>${task.domain} · ${task.weight}%</small>
          <p>${task.prompt || ''}</p>
        </div>`).join('')}
      </div>

      <div class="exam-terminal">
        <div class="cyan">Session: ${exam.session_id}</div>
        <div>Expires: ${expires}</div>
        <div>Time limit: 120 minutes</div>
        <br>

        ${exam.terminal_url
          ? `<div class="green">Lab ready</div>
             <p>Terminal login: <strong>${exam.terminal_username}</strong> / <strong>${exam.terminal_password}</strong></p>
             <a class="primary-btn" target="_blank" rel="noreferrer" href="${exam.terminal_url}">Open live terminal ↗</a>
             <button class="danger-btn" id="submit-exam" style="margin-left:8px">Submit & grade</button>`
          : '<div class="amber">Lab is provisioning. This page checks readiness automatically.</div>'}
      </div>
    </div>
  </section>`;

  document.querySelector('#submit-exam')?.addEventListener(
    'click',
    () => submitExam(exam.session_id).catch(error => msg(error.message, 'danger'))
  );
}

function bind() {
  document.querySelector('#logout')?.addEventListener('click', () => {
    signOut();
    entitlements = null;
    activeSession = null;
    render();
  });

  document.querySelector('#login')?.addEventListener('click', async () => {
    try {
      await signIn(
        document.querySelector('#login-email').value,
        document.querySelector('#login-password').value
      );
      await refreshEntitlements();
      render();
    } catch (error) {
      msg(error.message, 'danger');
    }
  });

  document.querySelector('#signup')?.addEventListener('click', async () => {
    try {
      await signUp(
        document.querySelector('#signup-email').value,
        document.querySelector('#signup-password').value
      );
      msg('Verification code sent. Verify your email, then sign in to receive 2 free credits.');
    } catch (error) {
      msg(error.message, 'danger');
    }
  });

  document.querySelector('#confirm')?.addEventListener('click', async () => {
    try {
      await confirmSignUp(
        document.querySelector('#signup-email').value,
        document.querySelector('#confirm-code').value
      );
      msg('Email verified. Sign in to activate your free credits.');
    } catch (error) {
      msg(error.message, 'danger');
    }
  });

  document.querySelectorAll('.buy').forEach(button => {
    button.addEventListener(
      'click',
      () => buy(button.dataset.product).catch(error => msg(error.message, 'danger'))
    );
  });

  document.querySelectorAll('.start').forEach(button => {
    button.addEventListener(
      'click',
      () => startExam(
        button.dataset.exam,
        button.dataset.catalog
      ).catch(error => msg(error.message, 'danger'))
    );
  });
}

await loadPublicData();
await refreshEntitlements();
render();
if (activeSession) renderExam(activeSession);
