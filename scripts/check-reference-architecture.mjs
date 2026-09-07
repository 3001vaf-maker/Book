import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
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

function text(file) {
  return readFileSync(file, 'utf8');
}

function report(file, rule) {
  errors.push(`${relative(root, file)}: ${rule}`);
}

const mainFiles = walk(join(root, 'main'));
const settingsFiles = walk(join(root, 'settings'));
const referenceFiles = [...mainFiles, ...settingsFiles];
const uiFiles = walk(join(root, 'ui'));
const coreFiles = walk(join(root, 'core'));
const allFiles = [...walk(join(root, 'main')), ...walk(join(root, 'settings')), ...uiFiles, ...coreFiles, join(root, 'core.js')];

for (const file of referenceFiles) {
  const source = text(file);
  if (/<select\b/i.test(source)) report(file, 'native <select> is forbidden in reference branches; use shared select()');
  if (/<datalist\b/i.test(source)) report(file, 'native <datalist> is forbidden in reference branches; use shared searchableSelect()');
}

for (const file of uiFiles) {
  const source = text(file);
  if (source.includes('🗑')) report(file, 'trash glyph is forbidden in shared UI; ordinary removal uses ×');
  if (/\blocalStorage\b/.test(source)) report(file, 'shared UI must not own persistence/localStorage');
}

for (const file of coreFiles) {
  const source = text(file);
  if (/from\s+['"][^'"]*(?:settings|main)\//.test(source)) report(file, 'core domain module must not import feature/entity folders');
}

const workplaceOwner = 'settings/profile/workplaces/data.js';
for (const file of allFiles) {
  const source = text(file);
  if (!source.includes('book.workplaces')) continue;
  if (relative(root, file).replaceAll('\\', '/') !== workplaceOwner) report(file, 'book.workplaces may only be accessed by the Workplace data owner');
}

const clientsUi = join(root, 'main/clients/clients.js');
if (/\blocalStorage\b/.test(text(clientsUi))) report(clientsUi, 'Clients screen must use data/view-state owners instead of direct localStorage');

const settingsControllers = [
  'settings/profile/profile.js',
  'settings/service/service.js',
  'settings/warehouse/warehouse.js',
  'settings/documents/documents.js',
  'settings/loyalty/loyalty.js',
  'settings/tags/tags.js',
  'settings/wallets/wallets.js',
  'settings/service/procedures/procedures.js',
  'settings/service/products/products.js',
];
for (const controller of settingsControllers) {
  const file = join(root, controller);
  const source = text(file);
  if (!/export\s+function\s+render\b|export\s*\{[^}]*\bas\s+render\b[^}]*\}/s.test(source)) {
    report(file, 'Settings folder controller must expose the shared render(root, navigateBack) contract');
  }
}

const settingsRoot = join(root, 'settings/settings.js');
if (/module\.render\s*\|\|/.test(text(settingsRoot))) {
  report(settingsRoot, 'Settings must call the shared render() contract without fallback render names');
}

for (const file of allFiles) {
  if (relative(root, file).replaceAll('\\', '/') === 'ui/duration/index.js') continue;
  if (/\b(?:const|let|var|function)\s+durationText\b/.test(text(file))) {
    report(file, 'durationText() belongs only to ui/duration and must be imported through ui/ui.js');
  }
}

const uiFacade = join(root, 'ui/ui.js');
if (/export\s+function\b/.test(text(uiFacade))) report(uiFacade, 'ui/ui.js must remain a pure import/re-export facade');

if (errors.length) {
  console.error('reference architecture check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`reference architecture check: OK (${referenceFiles.length} reference files, ${uiFiles.length} UI files)`);
