const MEASUREMENT_ID = 'G-D46ECK19HJ';

function send(eventName, params = {}) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}

function currentRoute() {
  return window.location.hash || '#/';
}

function lessonIdFromRoute(route = currentRoute()) {
  const match = route.match(/^#\/learn\/([a-z0-9-]+)$/);
  return match?.[1] || null;
}

function routeType(route = currentRoute()) {
  if (route === '#/' || route === '') return 'home';
  if (route === '#/tracks') return 'tracks';
  if (route === '#/glossary') return 'glossary';
  if (route === '#/progress') return 'progress';
  if (lessonIdFromRoute(route)) return 'lesson';
  return 'other';
}

function alreadyCompleted(lessonId) {
  try {
    const ids = JSON.parse(localStorage.getItem('learn-k8s-completed') || '[]');
    return Array.isArray(ids) && ids.includes(lessonId);
  } catch {
    return false;
  }
}

let lastRoute = null;
let sandboxInteracted = false;

function trackRoute() {
  const route = currentRoute();
  if (route === lastRoute) return;
  lastRoute = route;
  sandboxInteracted = false;

  // Let the SPA router update document.title before analytics reads it.
  requestAnimationFrame(() => {
    const lessonId = lessonIdFromRoute(route);
    send('route_view', {
      route,
      route_type: routeType(route),
      page_title: document.title,
      ...(lessonId ? { lesson_id: lessonId } : {})
    });

    if (lessonId) {
      send('lesson_started', {
        lesson_id: lessonId,
        lesson_title: document.title.replace(/\s+—\s+Learn Kubernetes$/, '')
      });
    }
  });
}

function trackLessonCompletion(target) {
  if (!target.closest('[data-mark-complete]')) return;
  const lessonId = lessonIdFromRoute();
  if (!lessonId || alreadyCompleted(lessonId)) return;
  send('lesson_completed', { lesson_id: lessonId });
}

function trackChallengeAttempt(target) {
  const option = target.closest('.arena-option');
  if (!option || lessonIdFromRoute() !== 'challenge-arena') return;
  if (option.dataset.analyticsAnswered === '1') return;

  document.querySelectorAll('#lesson-root .arena-option').forEach(button => {
    button.dataset.analyticsAnswered = '1';
  });

  // The lesson's own click handler updates feedback first; inspect it next frame.
  requestAnimationFrame(() => {
    const feedback = document.querySelector('#lesson-root #feedback');
    const correct = feedback?.classList.contains('success') || false;
    send('challenge_answered', {
      correct,
      track: document.querySelector('#lesson-root #tag')?.textContent || 'unknown',
      domain: document.querySelector('#lesson-root #domain-tag')?.textContent || 'unknown',
      difficulty: document.querySelector('#lesson-root #stars')?.textContent?.length || 0
    });
  });
}

function trackSandboxInteraction(target) {
  if (sandboxInteracted || lessonIdFromRoute() !== 'cluster-sandbox') return;
  if (!target.closest('#lesson-root')) return;
  if (target.closest('[data-mark-complete]')) return;
  sandboxInteracted = true;
  send('sandbox_interaction');
}

// Capture lesson completion before the lesson handler updates localStorage.
document.addEventListener('click', event => trackLessonCompletion(event.target), true);

document.addEventListener('click', event => {
  trackChallengeAttempt(event.target);
  trackSandboxInteraction(event.target);
});

document.addEventListener('change', event => trackSandboxInteraction(event.target));
window.addEventListener('hashchange', trackRoute);
window.addEventListener('load', trackRoute, { once: true });

// Measurement IDs are public identifiers; no Analytics secrets are embedded here.
window.learnK8sAnalytics = Object.freeze({ measurementId: MEASUREMENT_ID });
