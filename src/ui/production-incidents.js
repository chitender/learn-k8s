import { incidentsForLesson } from '../data/production-incidents.js';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sourceClass(sourceType) {
  if (sourceType === 'Public postmortem' || sourceType === 'Public engineering incident') return 'success';
  if (sourceType === 'Stack Overflow case') return 'warn';
  return '';
}

function incidentCard(incident, index) {
  const challenge = incident.challenge;
  return `
    <article class="incident-case" data-incident-id="${escapeHtml(incident.id)}">
      <div class="incident-head">
        <div>
          <div class="eyebrow">Case ${index + 1} · ${escapeHtml(incident.sourceType)}</div>
          <h3>${escapeHtml(incident.title)}</h3>
        </div>
        <span class="badge incident-source-badge ${sourceClass(incident.sourceType)}">${escapeHtml(incident.sourceType)}</span>
      </div>

      <p class="hero-copy incident-summary">${escapeHtml(incident.summary)}</p>

      <div class="grid-2 incident-observation-grid">
        <div>
          <div class="eyebrow">What the on-call saw</div>
          <ul class="incident-list">${incident.symptoms.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </div>
        <div>
          <div class="eyebrow">Source confidence</div>
          <p class="incident-confidence">${escapeHtml(incident.confidence)}</p>
          <a class="resource-link" data-incident-source href="${escapeHtml(incident.sourceUrl)}" target="_blank" rel="noreferrer">Read original source ↗ ${escapeHtml(incident.sourceLabel)}</a>
        </div>
      </div>

      <div class="incident-challenge">
        <div class="eyebrow">On-call challenge · diagnose before revealing the postmortem</div>
        <h3>${escapeHtml(challenge.prompt)}</h3>
        <div class="quiz-options incident-options">
          ${challenge.choices.map((choice, choiceIndex) => `<button class="lesson-card incident-option" data-incident-answer="${choiceIndex}" style="min-height:auto"><h3>${String.fromCharCode(65 + choiceIndex)}. ${escapeHtml(choice)}</h3></button>`).join('')}
        </div>
        <div class="callout incident-feedback"><strong>Choose the most defensible diagnosis.</strong><p>Use the symptoms above. The evidence and root cause stay hidden until you commit to an answer.</p></div>
      </div>

      <div class="incident-reveal" hidden>
        <div class="grid-2">
          <div class="callout success" style="margin:0">
            <strong>Evidence that mattered</strong>
            <ul class="incident-list">${incident.evidence.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
          <div class="callout warn" style="margin:0">
            <strong>Root cause</strong>
            <p>${escapeHtml(incident.rootCause)}</p>
          </div>
        </div>
        <div class="callout" style="margin-top:12px"><strong>Production lesson</strong><p>${escapeHtml(incident.takeaway)}</p></div>
      </div>
    </article>`;
}

export function renderProductionIncidents(lessonId) {
  const incidents = incidentsForLesson(lessonId);
  if (!incidents.length) return '';
  return `
    <section class="production-incidents panel" data-production-incidents>
      <div class="section-head">
        <div>
          <div class="eyebrow">Production incident lab</div>
          <h2>Now debug what actually happened in production</h2>
          <p class="hero-copy">These cases are paraphrased from public postmortems, Stack Overflow investigations, and Reddit operator reports. Diagnose from symptoms first; then reveal the evidence and root cause.</p>
        </div>
        <span class="badge">${incidents.length} real-world case${incidents.length === 1 ? '' : 's'}</span>
      </div>
      <div class="callout warn"><strong>Source quality matters.</strong><p>First-party postmortems are treated as high-confidence incident records. Stack Overflow and Reddit cases are valuable operational evidence, but community reports are labeled explicitly and are not presented as canonical Kubernetes behavior unless the mechanism is independently established.</p></div>
      <div class="incident-stack">${incidents.map(incidentCard).join('')}</div>
    </section>`;
}

export function bindProductionIncidents(root, { lessonId, awardXP } = {}) {
  if (!root) return;
  root.querySelectorAll('[data-incident-id]').forEach(card => {
    let answered = false;
    const incident = incidentsForLesson(lessonId).find(item => item.id === card.dataset.incidentId);
    if (!incident) return;

    card.querySelectorAll('[data-incident-answer]').forEach(button => {
      button.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const selected = Number(button.dataset.incidentAnswer);
        const correct = selected === incident.challenge.answer;
        const feedback = card.querySelector('.incident-feedback');
        const reveal = card.querySelector('.incident-reveal');

        card.querySelectorAll('[data-incident-answer]').forEach((option, index) => {
          option.disabled = true;
          option.classList.toggle('incident-correct', index === incident.challenge.answer);
          option.classList.toggle('incident-wrong', index === selected && !correct);
        });

        let bonusText = '';
        if (correct && typeof awardXP === 'function') {
          const reward = awardXP(`incident:${incident.id}`, 40);
          if (reward?.awarded) bonusText = ` · +${reward.awarded} bonus XP`;
        }

        if (feedback) {
          feedback.className = `callout incident-feedback ${correct ? 'success' : 'danger'}`;
          feedback.innerHTML = `<strong>${correct ? `Correct${bonusText}` : `Best answer: ${escapeHtml(incident.challenge.choices[incident.challenge.answer])}`}</strong><p>${escapeHtml(incident.challenge.explanation)}</p>`;
        }
        if (reveal) reveal.hidden = false;

        if (typeof window.gtag === 'function') {
          window.gtag('event', 'production_incident_answered', {
            incident_id: incident.id,
            lesson_id: lessonId,
            source_type: incident.sourceType,
            correct
          });
        }
      });
    });

    const source = card.querySelector('[data-incident-source]');
    source?.addEventListener('click', () => {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'production_incident_source_opened', {
          incident_id: incident.id,
          lesson_id: lessonId,
          source_type: incident.sourceType
        });
      }
    });
  });
}
