import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const professionalHtml = read('index.html');
const userHtml = read('user.html');
const userEntry = read('online-booking/user-entry.js');
const server = read('server/src/main.ts');

function requireText(source, token, message) {
  if (!source.includes(token)) failures.push(message);
}

function rejectText(source, token, message) {
  if (source.includes(token)) failures.push(message);
}

requireText(professionalHtml, 'src="core.js"', 'Professional entry must keep core.js as its application entrypoint.');
requireText(userHtml, 'src="online-booking/user-entry.js"', 'End-user entry must use the dedicated online-booking/user-entry.js runtime.');
rejectText(userHtml, 'src="core.js"', 'End-user entry must not load the professional core.js graph.');
requireText(userHtml, 'src="core/chat/messenger-mode.js"', 'End-user entry must retain the shared Messenger owner.');
requireText(userHtml, 'src="core/password-reset-request.js"', 'End-user entry must retain shared password reset handling.');

for (const token of [
  '../core/finance/',
  '../core/inventory/',
  '../core/loyalty/',
  '../journal/',
  '../timetable/',
  '../settings/',
  '../core/profile/profile.js',
  '../core/service/service.js',
  '../core/runtime/',
]) {
  rejectText(userEntry, token, `End-user entry must not import professional startup graph: ${token}`);
}

requireText(server, "if (host === USER_HOST)", 'Server must own a distinct USER_HOST entry boundary.');
const userEntrypointRoutes = (server.match(/resolve\(siteRoot, 'user\.html'\)/g) || []).length;
if (userEntrypointRoutes < 2) {
  failures.push('USER_HOST root and public booking fallback must both resolve user.html.');
}
requireText(server, "if (host === APP_HOST)", 'Professional APP_HOST boundary must remain explicit.');

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('domain entrypoint separation check: OK');
