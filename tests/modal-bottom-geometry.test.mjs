import assert from 'node:assert/strict';
import fs from 'node:fs';
import { v2ModalPortalGeometry } from '../ui/v2/modal-geometry.js';

const baseHost={left:16,top:72,right:390,width:374,height:772,bottom:844};

const full=v2ModalPortalGeometry(baseHost,{offsetLeft:0,offsetTop:0,width:390,height:844});
assert.equal(full.left,16);
assert.equal(full.top,72);
assert.equal(full.width,374);
assert.equal(full.bottom,844);
assert.equal(full.height,772);

const keyboard=v2ModalPortalGeometry(baseHost,{offsetLeft:0,offsetTop:0,width:390,height:508});
assert.equal(keyboard.bottom,508);
assert.equal(keyboard.height,436);

const restored=v2ModalPortalGeometry(
  {...baseHost,height:436,bottom:508},
  {offsetLeft:0,offsetTop:0,width:390,height:844},
);
assert.equal(restored.bottom,844);
assert.equal(restored.height,772);

const shiftedViewport=v2ModalPortalGeometry(
  {left:28,top:82,right:390,width:362},
  {offsetLeft:0,offsetTop:12,width:390,height:832},
);
assert.equal(shiftedViewport.bottom,844);
assert.equal(shiftedViewport.left,28);

const core=fs.readFileSync(new URL('../core.js',import.meta.url),'utf8');
const selectors=fs.readFileSync(new URL('../ui/selectors/index.js',import.meta.url),'utf8');
const inputs=fs.readFileSync(new URL('../ui/inputs/index.js',import.meta.url),'utf8');
const sharedProfile=fs.readFileSync(new URL('../ui/profile/index.js',import.meta.url),'utf8');
const v2=fs.readFileSync(new URL('../ui/v2/index.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../ui/v2/v2.css',import.meta.url),'utf8');
const modals=fs.readFileSync(new URL('../ui/modals/index.js',import.meta.url),'utf8');
const modalCss=fs.readFileSync(new URL('../ui/modals/modal.css',import.meta.url),'utf8');

assert.match(core,/if \(target\.closest\('\[data-v2-layer\]'\)\) return;/);
assert.match(selectors,/mountModal\(trigger, modal\(content, \{ variant: 'x'/);
assert.match(inputs,/searchable:\s*true/);
assert.match(sharedProfile,/variant:\s*'x'/);
assert.match(v2,/document\.body\.appendChild\(portal\)/);
assert.match(v2,/visualViewport\?\.addEventListener\('resize', settle\)/);
assert.match(v2,/document\.addEventListener\('focusout', settle, true\)/);
assert.match(css,/\.v2-layer-portal--viewport\{position:fixed/);
assert.match(modals,/openNotice\(\{ title = 'Внимание', message = '', surface = 'app'/);
assert.match(modals,/modal\(content, \{ variant: 's', surface, title \}\)/);
assert.doesNotMatch(modals,/data-notice-close|action = 'ОК'/);
assert.match(modals,/variant === 'x'\) return 'bottom'/);
assert.match(modals,/variant === 's'\) return 'top'/);
assert.match(modalCss,/modal--bottom\.modal--form-sheet/);

console.log('modal bottom geometry tests passed');
