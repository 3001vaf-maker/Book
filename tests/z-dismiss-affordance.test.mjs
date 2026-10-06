import assert from 'node:assert/strict';
import fs from 'node:fs';

const affordance=fs.readFileSync(new URL('../ui/v2/z-affordance.js',import.meta.url),'utf8');
const layout=fs.readFileSync(new URL('../ui/v2/z-layout.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../ui/v2/shell.js',import.meta.url),'utf8');
const stack=fs.readFileSync(new URL('../ui/v2/z-stack.js',import.meta.url),'utf8');
const navigation=fs.readFileSync(new URL('../ui/v2/workspace-navigation.js',import.meta.url),'utf8');
const alphabet=fs.readFileSync(new URL('../UI_ALPHABET.md',import.meta.url),'utf8');

assert.match(affordance,/width:20px/);
assert.match(affordance,/height:20px/);
assert.match(affordance,/background:transparent/);
assert.doesNotMatch(affordance,/position:sticky/);
assert.match(affordance,/data-v2-z-header.*data-v2-z-dismiss/);
assert.match(layout,/data-v2-z-header/);
assert.match(layout,/min-height:40px/);
assert.match(layout,/position:sticky/);
assert.match(layout,/padding:0 18px 20px 0/);
assert.match(layout,/data-v2-z-body/);
assert.match(layout,/v2ZFrame/);
assert.match(shell,/v2ZFrame\(body\)/);
assert.match(shell,/style="padding-top:0"/);
assert.match(shell,/data-v2-edge-swipe aria-hidden="true" style="top:20px"/);
assert.match(stack,/v2ZFrame\(content\)/);
assert.match(stack,/bindV2ZDismissAffordance\(node, \{ onDismiss: close \}\)/);
assert.match(navigation,/const dismissBaseZ = \(\) =>/);
assert.match(navigation,/onDismiss: dismissBaseZ/);
assert.match(navigation,/dismissBaseZ\(\);/);
assert.match(alphabet,/Z Header существует всегда/);
assert.match(alphabet,/минимальная высота `40 px`/);
assert.match(alphabet,/всё текущее содержимое инструмента сначала принадлежит `Z Body`/);

console.log('Z header/body contract passed');
