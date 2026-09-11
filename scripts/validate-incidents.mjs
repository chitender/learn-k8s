import { curriculum } from '../src/catalog.js';
import { PRODUCTION_INCIDENTS } from '../src/data/production-incidents.js';

const failures = [];
const fail = message => failures.push(message);
const lessonIds = new Set(curriculum.flatMap(section => section.lessons.map(lesson => lesson.id)));
const sourceTypes = new Set([
  'Public postmortem',
  'Public engineering incident',
  'Stack Overflow case',
  'Reddit community report',
  'Reddit community case'
]);

const ids = new Set();
for (const incident of PRODUCTION_INCIDENTS) {
  if (!incident.id) fail('Incident missing id.');
  if (ids.has(incident.id)) fail(`Duplicate production incident id: ${incident.id}`);
  ids.add(incident.id);

  if (!incident.title || !incident.summary || !incident.rootCause || !incident.takeaway) {
    fail(`Incomplete narrative fields for incident: ${incident.id}`);
  }
  if (!sourceTypes.has(incident.sourceType)) fail(`Unexpected source type for ${incident.id}: ${incident.sourceType}`);
  if (!incident.sourceLabel || !/^https:\/\//.test(incident.sourceUrl || '')) fail(`Invalid source for incident: ${incident.id}`);
  if (!incident.confidence) fail(`Missing confidence label for incident: ${incident.id}`);

  if (!Array.isArray(incident.lessons) || incident.lessons.length === 0) fail(`Incident has no lesson mappings: ${incident.id}`);
  for (const lessonId of incident.lessons || []) {
    if (!lessonIds.has(lessonId)) fail(`Incident ${incident.id} maps to unknown lesson: ${lessonId}`);
  }

  if (!Array.isArray(incident.symptoms) || incident.symptoms.length < 2) fail(`Incident needs at least two symptoms: ${incident.id}`);
  if (!Array.isArray(incident.evidence) || incident.evidence.length < 2) fail(`Incident needs at least two evidence points: ${incident.id}`);

  const challenge = incident.challenge;
  if (!challenge?.prompt || !challenge?.explanation) fail(`Incident challenge incomplete: ${incident.id}`);
  if (!Array.isArray(challenge?.choices) || challenge.choices.length !== 4) fail(`Incident challenge must have exactly four choices: ${incident.id}`);
  if (!Number.isInteger(challenge?.answer) || challenge.answer < 0 || challenge.answer > 3) fail(`Incident challenge answer index invalid: ${incident.id}`);
  if (new Set(challenge?.choices || []).size !== 4) fail(`Incident challenge has duplicate choices: ${incident.id}`);
}

const counts = PRODUCTION_INCIDENTS.reduce((acc, incident) => {
  acc[incident.sourceType] = (acc[incident.sourceType] || 0) + 1;
  return acc;
}, {});

if (!(counts['Public postmortem'] || counts['Public engineering incident'])) fail('Incident library should include at least one first-party/public engineering incident.');
if (!counts['Stack Overflow case']) fail('Incident library should include Stack Overflow cases.');
if (!(counts['Reddit community report'] || counts['Reddit community case'])) fail('Incident library should include Reddit community cases.');

if (failures.length) {
  console.error(`\nProduction incident validation failed with ${failures.length} issue(s):`);
  failures.forEach(message => console.error(`  ✗ ${message}`));
  process.exit(1);
}

const attachedLessons = new Set(PRODUCTION_INCIDENTS.flatMap(incident => incident.lessons));
console.log(`✓ ${PRODUCTION_INCIDENTS.length} curated production incidents validated across ${attachedLessons.size} lessons.`);
console.log(`✓ Source mix: ${Object.entries(counts).map(([type, count]) => `${type}=${count}`).join(', ')}.`);
