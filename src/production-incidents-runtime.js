import { incidentsForLesson } from './data/production-incidents.js';
import { renderProductionIncidents, bindProductionIncidents } from './ui/production-incidents.js';

function currentLessonId() {
  const match = (window.location.hash || '').match(/^#\/learn\/([a-z0-9-]+)$/);
  return match?.[1] || null;
}

function awardIncidentXP(key, amount = 40) {
  try {
    const solvedKey = 'learn-k8s-challenges-solved';
    const xpKey = 'learn-k8s-challenge-xp';
    const solved = new Set(JSON.parse(localStorage.getItem(solvedKey) || '[]'));
    if (solved.has(key)) return { awarded: 0, total: Number(localStorage.getItem(xpKey) || 0) || 0 };
    solved.add(key);
    localStorage.setItem(solvedKey, JSON.stringify([...solved]));
    const current = Math.max(0, Number(localStorage.getItem(xpKey) || 0) || 0);
    const award = Math.max(0, Number(amount) || 0);
    const total = current + award;
    localStorage.setItem(xpKey, String(total));
    return { awarded: award, total };
  } catch {
    return { awarded: 0, total: 0 };
  }
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
  bindProductionIncidents(host, { lessonId, awardXP: awardIncidentXP });
}

const app = document.querySelector('#app');
if (app) {
  const observer = new MutationObserver(() => injectIncidentLab());
  observer.observe(app, { childList: true, subtree: true });
}

window.addEventListener('hashchange', () => requestAnimationFrame(injectIncidentLab));
window.addEventListener('load', () => requestAnimationFrame(injectIncidentLab), { once: true });
requestAnimationFrame(injectIncidentLab);
