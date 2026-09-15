import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manualLink = readFileSync(new URL('../admin/manual-link.js', import.meta.url), 'utf8');
const accessCss = readFileSync(new URL('../admin/access-control.css', import.meta.url), 'utf8');
const accessHelp = readFileSync(new URL('../admin/access-help.js', import.meta.url), 'utf8');

assert.match(manualLink, /button\.hidden\s*=\s*Boolean\(document\.querySelector\('\.admin-drawer-backdrop, #manual-invite-modal'\)\)/);
assert.match(manualLink, /#\$\{BUTTON_ID\}\[hidden\]\{display:none!important\}/);
assert.match(accessCss, /\.admin-drawer \.admin-actions\{[\s\S]*position:sticky/);
assert.match(accessCss, /z-index:20/);
assert.match(accessHelp, /Статус «Активен» означает только/);
assert.match(accessHelp, /Сохранить доступы/);

console.log('admin access control tests: OK');
