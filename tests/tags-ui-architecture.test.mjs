import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tags = readFileSync(new URL('../settings/tags/tags.js', import.meta.url), 'utf8');

assert.match(tags, /workspaceHeaderContext\(\{[\s\S]*title: 'Ярлыки'[\s\S]*label: '\+'/);
assert.match(tags, /miniCardRail\(items\.map\(tagCard\)\)/);
assert.match(tags, /miniCard\(\{/);
assert.match(tags, /data-tag-edit/);
assert.match(tags, /variant: 'bottom'/);
assert.match(tags, /colorPicker\(\{/);
assert.match(tags, /field\(\{[\s\S]*label: 'Название ярлыка'/);
assert.match(tags, /button\('Сохранить'/);
assert.match(tags, /if \(existing\)[\s\S]*saveTags\(getTags\(\)\.map/);
assert.doesNotMatch(tags, /pageHeader|iconButton|tagManagerList|data-delete-tag|confirmDelete/);

console.log('tags UI architecture tests: OK');
