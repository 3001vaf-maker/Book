import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const featureRoots = ['main', 'settings', 'timetable', 'journal', 'chat'];
const errors = [];

function walk(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...walk(path));
    else if (/\.js$/.test(name)) result.push(path);
  }
  return result;
}

for (const file of featureRoots.flatMap((dir) => walk(join(root, dir)))) {
  const source = readFileSync(file, 'utf8');
  const relativePath = relative(root, file).replaceAll('\\', '/');
  const addedWindowEvents = [...source.matchAll(/window\.addEventListener\(\s*(['"])([^'"]+)\1/g)].map((match) => match[2]);
  const removedWindowEvents = new Set([...source.matchAll(/window\.removeEventListener\(\s*(['"])([^'"]+)\1/g)].map((match) => match[2]));

  for (const eventName of new Set(addedWindowEvents)) {
    if (!removedWindowEvents.has(eventName)) {
      errors.push(`${relativePath}: window listener "${eventName}" has no matching cleanup`);
    }
  }
}

const coreSource = readFileSync(join(root, 'core.js'), 'utf8');
if (!/let\s+disposeView\s*=/.test(coreSource) || !/disposeView\(\);/.test(coreSource)) {
  errors.push('core.js: route render lifecycle must dispose the previous view before replacement');
}

if (errors.length) {
  console.error('runtime lifecycle check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('runtime lifecycle check: OK');
