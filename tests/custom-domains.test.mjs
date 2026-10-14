import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const environment = readFileSync(new URL('../core/environment.js', import.meta.url), 'utf8');
const serverMain = readFileSync(new URL('../server/src/main.ts', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appManifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
const userManifest = JSON.parse(readFileSync(new URL('../pwa/user/manifest.webmanifest', import.meta.url), 'utf8'));

assert.match(environment, /https:\/\/api\.va-tools\.ru/);
assert.match(environment, /https:\/\/admin\.va-tools\.ru/);
assert.match(environment, /https:\/\/app\.va-tools\.ru/);
assert.match(environment, /https:\/\/user\.va-tools\.ru/);
assert.doesNotMatch(environment, /https:\/\/book\.va-tools\.ru/);
assert.doesNotMatch(environment, /https:\/\/client\.va-tools\.ru/);
assert.doesNotMatch(environment, /amvera\.io/);

assert.match(serverMain, /api\.va-tools\.ru/);
assert.match(serverMain, /admin\.va-tools\.ru/);
assert.match(serverMain, /app\.va-tools\.ru/);
assert.match(serverMain, /user\.va-tools\.ru/);
assert.doesNotMatch(serverMain, /book\.va-tools\.ru/);
assert.doesNotMatch(serverMain, /client\.va-tools\.ru/);
assert.match(serverMain, /host === ADMIN_HOST/);
assert.match(serverMain, /host === API_HOST/);
assert.match(serverMain, /host === APP_HOST/);
assert.match(serverMain, /host === USER_HOST/);
assert.match(serverMain, /USER_PWA_ASSETS/);
assert.match(serverMain, /pwa\/user\/manifest\.webmanifest/);
assert.match(serverMain, /pwa\/user\/app-icon\.svg/);
assert.match(serverMain, /publicBookingPath/);
assert.match(serverMain, /sendFile\(resolve\(siteRoot, 'index\.html'\)\)/);

assert.match(indexHtml, /<base href="\/">/);
assert.match(indexHtml, /theme-color" content="#2F3338"/);
assert.match(indexHtml, /rel="manifest" href="\/manifest\.webmanifest"/);
assert.match(indexHtml, /rel="apple-touch-icon" sizes="192x192" href="\/icon-192\.png"/);
assert.match(indexHtml, /user\.va-tools\.ru/);
assert.match(indexHtml, /'Запись' : 'Кабинет'/);

assert.equal(appManifest.name, 'Кабинет');
assert.equal(appManifest.short_name, 'Кабинет');
assert.equal(userManifest.name, 'Запись');
assert.equal(userManifest.short_name, 'Запись');
assert.equal(appManifest.theme_color, '#2F3338');
assert.equal(userManifest.theme_color, '#2F3338');
assert.ok(appManifest.icons.some((icon) => icon.src === '/icon-192.png' && icon.sizes === '192x192'));
assert.ok(appManifest.icons.some((icon) => icon.src === '/app-icon.svg' && icon.sizes === 'any'));
assert.ok(userManifest.icons.some((icon) => icon.src === '/icon-192.png' && icon.sizes === '192x192'));
assert.ok(userManifest.icons.some((icon) => icon.src === '/app-icon.svg' && icon.sizes === 'any'));

for (const path of [
  '../app-icon.svg',
  '../icon-192.png',
  '../pwa/user/app-icon.svg',
  '../pwa/user/icon-192.png',
]) {
  assert.equal(existsSync(new URL(path, import.meta.url)), true, `${path} must exist`);
}

assert.match(dockerfile, /COPY --from=frontend-build \/app\/_site \/app\/site/);

console.log('custom domain runtime tests: OK');
