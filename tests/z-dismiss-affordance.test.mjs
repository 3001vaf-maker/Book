import assert from 'node:assert/strict';
import fs from 'node:fs';

const affordance=fs.readFileSync(new URL('../ui/v2/z-affordance.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../ui/v2/shell.js',import.meta.url),'utf8');
const stack=fs.readFileSync(new URL('../ui/v2/z-stack.js',import.meta.url),'utf8');
const navigation=fs.readFileSync(new URL('../ui/v2/workspace-navigation.js',import.meta.url),'utf8');
const alphabet=fs.readFileSync(new URL('../UI_ALPHABET.md',import.meta.url),'utf8');

assert.match(affordance,/width:20px/);
assert.match(affordance,/height:20px/);
assert.match(affordance,/background:transparent/);
assert.match(affordance,/position:sticky/);
assert.match(affordance,/data-v2-z-dismiss/);
assert.match(shell,/v2ZDismissAffordance\(\)\}\$\{body\}/);
assert.match(shell,/data-v2-edge-swipe aria-hidden="true" style="top:20px"/);
assert.match(stack,/v2ZDismissAffordance\(\)\}\$\{content\}/);
assert.match(stack,/bindV2ZDismissAffordance\(node, \{ onDismiss: close \}\)/);
assert.match(navigation,/const dismissBaseZ = \(\) =>/);
assert.match(navigation,/onDismiss: dismissBaseZ/);
assert.match(navigation,/dismissBaseZ\(\);/);
assert.match(alphabet,/прозрачная зона ровно `20×20 px`/);
assert.match(alphabet,/тот же один шаг возврата, что и успешный swipe вправо/);

console.log('Z dismiss affordance contract passed');
