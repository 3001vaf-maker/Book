import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const self = relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
const retiredProfileOwner = ['settings', 'profile'].join('/');
const retiredServiceOwner = ['settings', 'service'].join('/');

assert.equal(existsSync(resolve(root, 'core/profile/profile.js')), true, 'Profile must be owned by core/profile');
assert.equal(existsSync(resolve(root, 'core/profile/runtime.js')), true, 'Profile runtime must be owned by core/profile');
assert.equal(existsSync(resolve(root, 'core/service/service.js')), true, 'Service must be owned by core/service');
assert.equal(existsSync(resolve(root, 'core/service/procedures/data.js')), true, 'Service procedures must be owned by core/service');
assert.equal(existsSync(resolve(root, retiredProfileOwner)), false, 'Profile must never exist under Settings');
assert.equal(existsSync(resolve(root, retiredServiceOwner)), false, 'Service must never exist under Settings');

const core = readFileSync(resolve(root, 'core.js'), 'utf8');
const settings = readFileSync(resolve(root, 'settings/settings.js'), 'utf8');

assert.match(core, /from '\.\/core\/profile\/profile\.js'/);
assert.match(core, /from '\.\/core\/profile\/runtime\.js'/);
assert.match(core, /from '\.\/core\/service\/service\.js'/);
assert.match(core, /\{ id: 'profile', label: 'Профиль'/);
assert.match(core, /\{ id: 'service', label: 'Сервис', capability: 'services\.access' \}/);
assert.match(core, /if \(section === 'profile'\) return renderProfile/);
assert.match(core, /if \(section === 'service'\) return renderService/);
assert.doesNotMatch(settings, /['"]profile['"]|['"]service['"]|Профиль|Сервис/);

const rootSectionsStart = core.indexOf('const ROOT_SECTIONS = [');
const rootSectionsEnd = core.indexOf('];', rootSectionsStart);
assert.notEqual(rootSectionsStart, -1, 'ROOT_SECTIONS must exist');
assert.notEqual(rootSectionsEnd, -1, 'ROOT_SECTIONS must be closed');
const rootSections = core.slice(rootSectionsStart, rootSectionsEnd + 2);
assert.doesNotMatch(rootSections, /id:\s*'chat'/, 'D Chat must not become an F root section');
assert.match(core, /state\.activeSection === 'chat' \? state\.lastRootSection : state\.activeSection/);
assert.match(core, /book:record-chat-request/);
assert.match(core, /renderChat\(layer/);

const textExtensions = new Set(['.js', '.mjs', '.ts', '.md', '.json', '.yml', '.yaml', '.html', '.css']);
const excluded = new Set(['.git', 'node_modules']);
const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (excluded.has(name)) continue;
    const full = resolve(dir, name);
    const rel = relative(root, full).replaceAll('\\', '/');
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (rel === self || !textExtensions.has(extname(name))) continue;
    const text = readFileSync(full, 'utf8');
    if (text.includes(retiredProfileOwner) || text.includes(retiredServiceOwner)) violations.push(rel);
  }
}

walk(root);
assert.deepEqual(violations, [], `Retired Settings ownership references found:\n${violations.join('\n')}`);

console.log('root feature ownership check: OK');
