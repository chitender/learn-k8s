import { incidentsForLesson } from './data/production-incidents.js';
import { awardChallenge } from './gamification.js';
import { renderProductionIncidents, bindProductionIncidents } from './ui/production-incidents.js';

function currentLessonId() {
  const match = (window.location.hash || '').match(/^#\/learn\/([a-z0-9-]+)$/);
  return match?.[1] || null;
}

function injectIncidentLab() {
  const lessonId = currentLessonId();
  const lessonRoot = document.querySelector('#lesson-root');
  if (!lessonId || !lessonRoot) return;
  if (!incidentsForLesson(lessonId).length) return;

  const existing = document.querySelector('[data-production-incidents-host]');
  if (existing?.dataset.lessonId === lessonId) return;
  existing?.remove();

  const host = document.createElement('div');
  host.dataset.productionIncidentsHost = 'true';
  host.dataset.lessonId = lessonId;
  host.innerHTML = renderProductionIncidents(lessonId);
  lessonRoot.insertAdjacentElement('afterend', host);
  bindProductionIncidents(host, { lessonId, awardXP: awardChallenge });
}

const app = document.querySelector('#app');
if (app) {
  const observer = new MutationObserver(() => injectIncidentLab());
  observer.observe(app, { childList: true, subtree: true });
}

window.addEventListener('hashchange', () => requestAnimationFrame(injectIncidentLab));
window.addEventListener('load', () => requestAnimationFrame(injectIncidentLab), { once: true });
requestAnimationFrame(injectIncidentLab);
