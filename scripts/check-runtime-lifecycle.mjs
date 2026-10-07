import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const featureRoots = ['core/people', 'core/finance', 'settings', 'timetable', 'journal', 'chat'];
const errors = [];

// Explicit module-lifetime listeners are installed exactly once by ES module loading
// and intentionally live for the lifetime of the application. Route/view listeners
// remain required to provide a matching cleanup.
const applicationLifetimeWindowListeners = new Set([
  'chat/chat.js::book:record-chat-request',
]);

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
    if (applicationLifetimeWindowListeners.has(`${relativePath}::${eventName}`)) continue;
    if (!removedWindowEvents.has(eventName)) {
      errors.push(`${relativePath}: window listener "${eventName}" has no matching cleanup`);
    }
  }
}

const modalPortalSource = readFileSync(join(root, 'ui/v2/modal-portal.js'), 'utf8');
if (!/const\s+nativeRemove\s*=\s*node\.remove\.bind\(node\)/.test(modalPortalSource)
  || !/if\s*\(node\.isConnected\)\s*nativeRemove\(\)/.test(modalPortalSource)
  || !/node\.v2Close\s*=\s*close/.test(modalPortalSource)
  || !/node\.remove\s*=\s*close/.test(modalPortalSource)) {
  errors.push('ui/v2/modal-portal.js: every mounted V2 layer must route remove() through the canonical close lifecycle');
}

const durationSource = readFileSync(join(root, 'ui/duration/index.js'), 'utf8');
if (/modalRoot\.remove\s*\(/.test(durationSource) || !/modalRoot\.v2Close\?\.\(\)/.test(durationSource)) {
  errors.push('ui/duration/index.js: duration picker must close through v2Close()');
}

const coreSource = readFileSync(join(root, 'core.js'), 'utf8');
if (!/let\s+disposeView\s*=/.test(coreSource) || !/disposeView\(\);/.test(coreSource)) {
  errors.push('core.js: route render lifecycle must dispose the previous view before replacement');
}

if (/syncWorkspaceBack|v2-workspace-back/.test(coreSource)) {
  errors.push('core.js: retired workspace Back owner must not return; FEZ navigation is gesture-owned');
}

const dockerfile = readFileSync(join(root, 'Dockerfile'), 'utf8');
const stagingCompose = readFileSync(join(root, 'docker-compose.staging.yml'), 'utf8');
const databaseWait = readFileSync(join(root, 'server/scripts/wait-for-database.mjs'), 'utf8');

if (!/node scripts\/wait-for-database\.mjs && node scripts\/recover-failed-prelaunch-migration\.mjs/.test(dockerfile)) {
  errors.push('Dockerfile: production startup must wait for database readiness before migration recovery');
}
if (!/node scripts\/wait-for-database\.mjs && npx prisma migrate deploy/.test(stagingCompose)) {
  errors.push('docker-compose.staging.yml: staging startup must use the same database readiness gate');
}
if (!/DATABASE_WAIT_ATTEMPTS/.test(databaseWait)
  || !/DATABASE_WAIT_DELAY_MS/.test(databaseWait)
  || !/SELECT 1/.test(databaseWait)
  || !/attempt < attempts/.test(databaseWait)) {
  errors.push('server/scripts/wait-for-database.mjs: database readiness must be bounded, retrying, and query-backed');
}

if (errors.length) {
  console.error('runtime lifecycle check: FAILED');
  for (const error of errors) console.error(`- ${error}`));
  process.exit(1);
}

console.log('runtime lifecycle check: OK');
