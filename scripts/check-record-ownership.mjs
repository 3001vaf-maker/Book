import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const errors = [];
const read = (path) => readFileSync(join(root, path), 'utf8');

function walk(dir) {
  const result = [];
  for (const name of readdirSync(join(root, dir))) {
    const path = join(root, dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...walk(relative(root, path)));
    else if (/\.(?:js|mjs)$/.test(name)) result.push(relative(root, path).replaceAll('\\', '/'));
  }
  return result;
}

const recordData = read('journal/record-data.js');
const recordRead = read('journal/record-read.js');
const recordService = read('journal/record-service.js');
const recordEvents = read('journal/record-events.js');
const recordState = read('journal/record-state.js');

if (/availability|financial-model|getAllClients|record-events|record-state|status\s*=|attendance|confirmed|cancelRecord|createRecord|updateRecord|moveRecord/.test(recordData)) {
  errors.push('journal/record-data.js: Record data must remain persistence-only');
}
if (!/getRecordRows/.test(recordData)
  || !/insertRecordRow/.test(recordData)
  || !/patchRecordRow/.test(recordData)
  || !/deleteRecordRow/.test(recordData)
  || !/getRecordEventRows/.test(recordData)
  || !/insertRecordEventRow/.test(recordData)
  || !/deleteRecordEventRows/.test(recordData)) {
  errors.push('journal/record-data.js: persistence gateway API is incomplete');
}

if (!/from '.\/record-data\.js'/.test(recordRead)
  || !/from '.\/record-events\.js'/.test(recordRead)
  || !/from '.\/record-state\.js'/.test(recordRead)
  || !/hydrateRecordFinance/.test(recordRead)) {
  errors.push('journal/record-read.js: read model must compose storage + lifecycle + finance');
}

if (!/from '.\/record-data\.js'/.test(recordService)
  || !/from '.\/record-read\.js'/.test(recordService)
  || !/from '.\/record-events\.js'/.test(recordService)
  || !/checkTimeAvailability/.test(recordService)) {
  errors.push('journal/record-service.js: command service must own Record mutations');
}
if (!/appendRecordEvent/.test(recordService) || !/RECORD_EVENT_TYPES\.CANCELLED/.test(recordService)) {
  errors.push('journal/record-service.js: lifecycle commands must append immutable Record events');
}

if (!/from '.\/record-data\.js'/.test(recordEvents)
  || !/appendRecordEvent/.test(recordEvents)
  || !/insertRecordEventRow/.test(recordEvents)
  || /localStorage/.test(recordEvents)) {
  errors.push('journal/record-events.js: Record Events must own lifecycle meaning while persistence stays in record-data.js');
}
if (!/projectRecordLifecycle/.test(recordState) || !/RECORD_EVENT_TYPES/.test(recordState)) {
  errors.push('journal/record-state.js: Record State must be projected from lifecycle facts');
}

const allowedDirectDataConsumers = new Set([
  'journal/record-read.js',
  'journal/record-service.js',
  'journal/record-events.js',
  'tests/record-lifecycle.test.mjs',
]);
const directDataImport = /(?:from\s+['"][^'"]*record-data\.js['"]|import\s*\(\s*['"][^'"]*record-data\.js['"]\s*\))/;
for (const path of [...walk('journal'), ...walk('main'), ...walk('settings'), ...walk('tests')]) {
  if (allowedDirectDataConsumers.has(path)) continue;
  const source = read(path);
  if (directDataImport.test(source)) {
    errors.push(`${path}: must use record-read.js for queries or record-service.js for commands, not record-data.js`);
  }
}

if (errors.length) {
  console.error('record ownership check: FAILED');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('record ownership check: OK');
