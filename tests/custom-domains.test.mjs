import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const environment = readFileSync(new URL('../core/environment.js', import.meta.url), 'utf8');
const bookingSettings = readFileSync(new URL('../settings/online-booking/online-booking.js', import.meta.url), 'utf8');
const manualInvitation = readFileSync(new URL('../server/src/manual-invitation/manual-invitation.service.ts', import.meta.url), 'utf8');
const userInvitation = readFileSync(new URL('../server/src/user-invitation/user-invitation.service.ts', import.meta.url), 'utf8');
const serverMain = readFileSync(new URL('../server/src/main.ts', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');

assert.match(environment, /https:\/\/api\.va-tools\.ru/);
assert.match(environment, /https:\/\/admin\.va-tools\.ru/);
assert.match(environment, /https:\/\/book\.va-tools\.ru/);
assert.match(environment, /https:\/\/client\.va-tools\.ru/);
assert.doesNotMatch(environment, /amvera\.io/);
assert.doesNotMatch(manualInvitation, /github\.io/);
assert.match(manualInvitation, /https:\/\/book\.va-tools\.ru/);
assert.match(userInvitation, /https:\/\/book\.va-tools\.ru/);
assert.match(bookingSettings, /PUBLIC_APP_ORIGIN/);
assert.doesNotMatch(bookingSettings, /window\.location\.origin/);
assert.match(core, /redirectBookingToPublicApp/);
assert.match(serverMain, /api\.va-tools\.ru/);
assert.match(serverMain, /admin\.va-tools\.ru/);
assert.match(serverMain, /book\.va-tools\.ru/);
assert.match(serverMain, /client\.va-tools\.ru/);
assert.match(serverMain, /host === ADMIN_HOST/);
assert.match(serverMain, /response\.redirect\(302, '\/admin\/'\)/);
assert.match(serverMain, /if \(host === API_HOST\) return next\(\)/);
assert.match(dockerfile, /COPY --from=frontend-build \/app\/_site \/app\/site/);

console.log('custom domain runtime tests: OK');
