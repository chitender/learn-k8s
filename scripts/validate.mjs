import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { curriculum, lessonLoaders } from '../src/catalog.js';
import { LESSON_DESCRIPTIONS } from '../src/data/lesson-descriptions.js';
import { LESSON_RESOURCES, SITE_META } from '../src/data/lesson-resources.js';
import { GLOSSARY } from '../src/data/glossary.js';
import { LEARNING_TRACKS } from '../src/data/learning-tracks.js';
import { CHALLENGES } from '../src/data/challenges.js';
import { PREREQUISITES } from '../src/gamification.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const warnings = [];
const fail = message => failures.push(message);
const warn = message => warnings.push(message);

const lessons = curriculum.flatMap(section => section.lessons.map(lesson => ({ ...lesson, sectionId:section.id })));
const ready = lessons.filter(lesson => lesson.status === 'ready');
const ids = lessons.map(lesson => lesson.id);
const idSet = new Set(ids);

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) seen.has(value) ? dupes.add(value) : seen.add(value);
  return [...dupes];
}

for (const duplicate of duplicates(ids)) fail(`Duplicate lesson id: ${duplicate}`);
for (const duplicate of duplicates(curriculum.map(section => section.id))) fail(`Duplicate section id: ${duplicate}`);

for (const lesson of ready) {
  if (typeof lessonLoaders[lesson.id] !== 'function') fail(`Ready lesson missing loader: ${lesson.id}`);
  if (!LESSON_DESCRIPTIONS[lesson.id]) fail(`Ready lesson missing description: ${lesson.id}`);
  if (!Array.isArray(LESSON_RESOURCES[lesson.id]) || LESSON_RESOURCES[lesson.id].length === 0) fail(`Ready lesson missing official reference: ${lesson.id}`);
  if (!lesson.title || !lesson.level || !Number.isFinite(lesson.minutes) || lesson.minutes <= 0) fail(`Invalid lesson metadata: ${lesson.id}`);

  const loader = lessonLoaders[lesson.id];
  if (loader) {
    const match = String(loader).match(/import\(['"](.+?)['"]\)/);
    if (!match) {
      fail(`Could not parse loader path for ${lesson.id}`);
    } else {
      const modulePath = path.resolve(root, 'src', match[1].replace(/^\.\//, ''));
      if (!fs.existsSync(modulePath)) {
        fail(`Loader target missing for ${lesson.id}: ${path.relative(root, modulePath)}`);
      } else {
        const source = fs.readFileSync(modulePath, 'utf8');
        if (!/export\s+(?:async\s+)?function\s+mount\s*\(|export\s+const\s+mount\s*=/.test(source)) fail(`Lesson module does not export mount(): ${lesson.id}`);
        if (source.trim().length < 250) fail(`Lesson module looks like a placeholder: ${lesson.id}`);
      }
    }
  }

  for (const resource of LESSON_RESOURCES[lesson.id] || []) {
    if (!resource?.label || !/^https:\/\//.test(resource?.url || '')) fail(`Invalid official reference for ${lesson.id}`);
  }
}

for (const loaderId of Object.keys(lessonLoaders)) if (!idSet.has(loaderId)) fail(`Loader exists without curriculum lesson: ${loaderId}`);
for (const descriptionId of Object.keys(LESSON_DESCRIPTIONS)) if (!idSet.has(descriptionId)) warn(`Description exists without curriculum lesson: ${descriptionId}`);
for (const resourceId of Object.keys(LESSON_RESOURCES)) if (!idSet.has(resourceId)) warn(`Reference exists without curriculum lesson: ${resourceId}`);

for (const [lessonId, prerequisites] of Object.entries(PREREQUISITES)) {
  if (!idSet.has(lessonId)) fail(`Prerequisite map references unknown lesson: ${lessonId}`);
  for (const prerequisite of prerequisites) {
    if (!idSet.has(prerequisite)) fail(`Unknown prerequisite ${prerequisite} for ${lessonId}`);
    if (prerequisite === lessonId) fail(`Lesson cannot depend on itself: ${lessonId}`);
  }
}

for (const track of LEARNING_TRACKS) {
  if (!track.id || !track.title || !Array.isArray(track.lessons) || !track.lessons.length) fail(`Invalid learning track: ${track.id || '<missing id>'}`);
  for (const lessonId of track.lessons || []) if (!idSet.has(lessonId)) fail(`Track ${track.id} references unknown lesson: ${lessonId}`);
  for (const duplicate of duplicates(track.lessons || [])) fail(`Track ${track.id} repeats lesson: ${duplicate}`);
}
for (const duplicate of duplicates(LEARNING_TRACKS.map(track => track.id))) fail(`Duplicate learning track id: ${duplicate}`);

const challengeIds = CHALLENGES.map(item => item.id);
for (const duplicate of duplicates(challengeIds)) fail(`Duplicate challenge id: ${duplicate}`);
for (const challenge of CHALLENGES) {
  if (!challenge.id || !['CKA','SRE'].includes(challenge.track)) fail(`Invalid challenge track: ${challenge.id}`);
  if (![1,2,3].includes(challenge.difficulty)) fail(`Invalid challenge difficulty: ${challenge.id}`);
  if (!challenge.domain || !challenge.prompt || !challenge.why) fail(`Incomplete challenge content: ${challenge.id}`);
  if (!Array.isArray(challenge.choices) || challenge.choices.length < 2) fail(`Challenge needs at least two choices: ${challenge.id}`);
  if (!Number.isInteger(challenge.answer) || challenge.answer < 0 || challenge.answer >= (challenge.choices?.length || 0)) fail(`Challenge answer index out of range: ${challenge.id}`);
}

const glossaryTerms = GLOSSARY.map(item => item.term.toLowerCase());
for (const duplicate of duplicates(glossaryTerms)) fail(`Duplicate glossary term: ${duplicate}`);
for (const item of GLOSSARY) if (!item.term || !item.definition || item.definition.length < 20) fail(`Incomplete glossary item: ${item.term || '<missing term>'}`);

if (!/^v1\.\d+$/.test(SITE_META.kubernetesBaseline)) fail(`Unexpected Kubernetes baseline: ${SITE_META.kubernetesBaseline}`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(SITE_META.validatedAt)) fail(`Invalid validation date: ${SITE_META.validatedAt}`);

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!index.includes('./src/app.js')) fail('index.html does not load src/app.js');
if (!index.includes('styles-experience.css')) fail('index.html does not load styles-experience.css');
if (!index.includes('Skip to main content')) fail('index.html is missing the skip-navigation link');

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
if (!readme.includes(`**${ready.length} interactive lessons**`)) fail(`README lesson count is stale; expected ${ready.length}`);
if (!readme.includes(SITE_META.kubernetesBaseline)) warn(`README does not mention Kubernetes baseline ${SITE_META.kubernetesBaseline}`);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes:true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const jsFiles = walk(path.join(root, 'src')).filter(file => file.endsWith('.js'))
  .concat(walk(path.join(root, 'scripts')).filter(file => file.endsWith('.mjs')));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding:'utf8' });
  if (result.status !== 0) fail(`Syntax error in ${path.relative(root, file)}: ${(result.stderr || result.stdout).trim()}`);
}

if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach(message => console.log(`  ⚠ ${message}`));
}

if (failures.length) {
  console.error(`\nValidation failed with ${failures.length} issue(s):`);
  failures.forEach(message => console.error(`  ✗ ${message}`));
  process.exit(1);
}

console.log(`✓ ${ready.length} ready lessons have loaders, modules, descriptions and official references.`);
console.log(`✓ ${LEARNING_TRACKS.length} learning tracks, ${CHALLENGES.length} challenges and ${GLOSSARY.length} glossary terms validated.`);
console.log(`✓ ${jsFiles.length} JavaScript files passed syntax checks.`);
console.log(`✓ Content baseline: Kubernetes ${SITE_META.kubernetesBaseline}, validated ${SITE_META.validatedAt}.`);
