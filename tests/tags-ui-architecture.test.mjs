import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tags = readFileSync(new URL('../settings/tags/tags.js', import.meta.url), 'utf8');
const miniCardCss = readFileSync(new URL('../ui/cards/mini-card.css', import.meta.url), 'utf8');

assert.match(tags, /workspaceHeaderContext\(\{[\s\S]*title: 'Ярлыки'[\s\S]*label: '\+'/);
assert.match(tags, /miniCardRail\(items\.map\(tagCard\)\)/);
assert.match(tags, /miniCard\(\{/);
assert.match(tags, /data-tag-edit/);
assert.match(tags, /variant: 'bottom'/);
assert.match(tags, /className: 'modal--form-sheet'/);
assert.doesNotMatch(tags, /modal--tag-editor/);
assert.match(tags, /colorPicker\(\{/);
assert.match(tags, /field\(\{[\s\S]*label: 'Название ярлыка'/);
assert.match(tags, /button\('Сохранить'/);
assert.match(tags, /if \(existing\)[\s\S]*saveTags\(getTags\(\)\.map/);
assert.doesNotMatch(tags, /pageHeader|iconButton|tagManagerList|data-delete-tag|confirmDelete/);

console.log('tags UI architecture tests: OK');

assert.match(miniCardCss, /\.mini-card-rail\{[\s\S]*scroll-padding-inline:max\(0px,calc\(\(100% - var\(--mini-card-width\)\)\/2\)\)[\s\S]*padding:3px max\(0px,calc\(\(100% - var\(--mini-card-width\)\)\/2\)\) 10px;[\s\S]*margin:0/);
assert.match(miniCardCss, /\.mini-card-rail>\.mini-card\{scroll-snap-align:center\}/);
assert.doesNotMatch(miniCardCss, /\.mini-card-rail\{[^}]*margin:-3px -2px -10px/);
