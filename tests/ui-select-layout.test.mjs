import assert from 'node:assert/strict';
import fs from 'node:fs';

const selectors = fs.readFileSync('ui/selectors/selectors.css', 'utf8');
const reference = fs.readFileSync('ui/reference/reference.js', 'utf8');

assert.match(selectors, /\.ui-select\{[^}]*min-width:0[^}]*max-width:100%/s);
assert.match(selectors, /\.ui-select__control\{[^}]*width:100%[^}]*max-width:100%[^}]*min-width:0[^}]*overflow:hidden/s);
assert.match(selectors, /\.ui-select__value\{[^}]*flex:1 1 auto[^}]*min-width:0[^}]*overflow:hidden[^}]*text-overflow:ellipsis/s);
assert.match(selectors, /\.ui-selector__wheel\{[^}]*max-width:min\(calc\(100vw - 32px\),calc\(var\(--app-max-width\) - 32px\)\)/s);
assert.match(selectors, /\.ui-selector__option\{[^}]*min-width:0[^}]*white-space:normal[^}]*overflow-wrap:anywhere/s);
assert.match(reference, /Очень длинное значение для проверки ширины Select на экране 390 px/);

console.log('shared Select layout tests passed');
