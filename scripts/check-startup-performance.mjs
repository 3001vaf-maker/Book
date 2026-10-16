import fs from 'node:fs';

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const errors = [];
const userHtml = source('user.html');
const userEntry = source('online-booking/user-entry.js');
const inventory = source('core/inventory/index.js');
const loyalty = source('core/loyalty/index.js');
const finance = source('core/finance/finance.js');
const auth = source('core/auth.js');
const serviceWorker = source('service-worker.js');
const appHtml = source('index.html');

if (/src=["']core\.js/.test(userHtml)) errors.push('user.html must not load the professional core.js entrypoint');
if (!/src=["']online-booking\/user-entry\.js/.test(userHtml)) errors.push('user.html must keep its dedicated end-user entrypoint');
for (const forbidden of ['core/finance/', 'core/inventory/', 'core/loyalty/', 'journal/', 'timetable/', 'core/profile/', 'core/service/']) {
  if (userEntry.includes(forbidden)) errors.push(`end-user entrypoint must not import professional owner: ${forbidden}`);
}

for (const forbidden of ["from './inventory.js'", "from './excel-v2.js'"]) {
  if (inventory.includes(forbidden)) errors.push(`Inventory implementation must remain lazy: ${forbidden}`);
}
if (!inventory.includes("import('./inventory.js')") || !inventory.includes("import('./excel-v2.js')")) {
  errors.push('Inventory must lazy-load its implementation and Excel runtime when opened');
}

for (const owner of ['deposit', 'personal-account', 'certificate', 'subscription', 'referral', 'bonus']) {
  const staticPattern = new RegExp(`from\\s+['\"]\\./${owner}/index\\.js['\"]`);
  if (staticPattern.test(loyalty)) errors.push(`Loyalty ${owner} owner must not be statically imported at startup`);
  if (!loyalty.includes(`import('./${owner}/index.js')`)) errors.push(`Loyalty ${owner} owner must remain lazy-loaded`);
}

for (const modulePath of ['./cash/cash.js', './dds/index.js', './z-report/index.js']) {
  const escaped = modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`from\\s+['\"]${escaped}['\"]`).test(finance)) errors.push(`Finance UI must not statically import ${modulePath}`);
  if (!finance.includes(`import('${modulePath}')`)) errors.push(`Finance UI must lazy-load ${modulePath}`);
}

for (const path of ['/profile', '/business-state', '/business-state/operational', '/auxiliary-state', '/finance', '/saas-access/me', '/tenant-document-archive/platform-bases']) {
  if (!auth.includes(`'${path}'`)) errors.push(`Professional startup preload missing ${path}`);
}
if (!auth.includes('startRuntimePreload')) errors.push('Professional startup requests must remain parallel preloads');

for (const html of [['index.html', appHtml], ['user.html', userHtml]]) {
  if (!html[1].includes('src="service-worker-runtime.js"')) errors.push(`${html[0]} must register the shared technical service worker`);
}
if (!serviceWorker.includes("url.searchParams.get('build')")) errors.push('Service Worker cache must be restricted to versioned build assets');
if (!/\\\.\(\?:js\|mjs\|css\)/.test(serviceWorker) && !serviceWorker.includes('(?:js|mjs|css)')) errors.push('Service Worker cache must remain limited to JS/MJS/CSS assets');
if (/\/api(?:\/|['"`])/.test(serviceWorker)) errors.push('Service Worker must never cache API/business responses');
if (!serviceWorker.includes('event.waitUntil(responsePromise.then(() => cacheWrite)')) errors.push('Cache writes must stay off the cold-load response path');

if (errors.length) {
  console.error('startup performance architecture check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('startup performance architecture check: OK');
