import assert from 'node:assert/strict';
import fs from 'node:fs';

const selectorsCss = fs.readFileSync('ui/selectors/selectors.css', 'utf8');
const selectorsUi = fs.readFileSync('ui/selectors/index.js', 'utf8');
const reference = fs.readFileSync('ui/reference/reference.js', 'utf8');

assert.match(selectorsCss, /\.ui-select\{[^}]*min-width:0[^}]*max-width:100%/s);
assert.match(selectorsCss, /\.ui-select__control\{[^}]*width:100%[^}]*max-width:100%[^}]*min-width:0[^}]*overflow:hidden/s);
assert.match(selectorsCss, /\.ui-select__value\{[^}]*flex:1 1 auto[^}]*min-width:0[^}]*overflow:hidden[^}]*text-overflow:ellipsis/s);
assert.match(selectorsCss, /\.ui-selector__wheel\{[^}]*width:100%[^}]*min-width:0/s);
assert.match(selectorsCss, /\.ui-selector__option\{[^}]*min-width:0[^}]*white-space:normal[^}]*overflow-wrap:anywhere/s);
assert.doesNotMatch(selectorsCss, /\.ui-selector\{[^}]*position:fixed/s);
assert.match(selectorsUi, /import \{ modal, mountModal \} from '\.\.\/modals\/index\.js'/);
assert.match(selectorsUi, /modal\(content, \{ variant: 'quick'/);
assert.match(selectorsUi, /input\.dispatchEvent\(new Event\('change'/);
assert.doesNotMatch(selectorsUi, /document\.body\.appendChild\(surface\)/);
assert.match(reference, /Очень длинное значение для проверки ширины Select на экране 390 px/);

console.log('shared Select layout tests passed');
