import fs from 'node:fs';
import assert from 'node:assert/strict';
import { ENTITY_CARD_LINE_COUNT, normalizeEntityCardAppearance, entityVisualCard } from '../ui/cards/entity-card-constructor.js';
import { profileCardAppearance, profileCardFields, workplaceCardAppearance, workplaceCardFields } from '../settings/profile/card-presentation.js';

assert.equal(ENTITY_CARD_LINE_COUNT, 9);

const normalized = normalizeEntityCardAppearance({
  lines: [{ field:'name', zone:'right', align:'center', size:'xl', color:'black', bold:true, italic:true, underline:true, uppercase:true }],
});
assert.equal(normalized.lines.length, 9);
assert.deepEqual(normalized.lines[0], {
  field:'name', zone:'right', align:'center', size:'xl', color:'black',
  bold:true, italic:true, underline:true, uppercase:true,
});

const profile={name:'Александр',surname:'Волоковых',profession:'Практик',phone:'+79104193490',emails:['a@example.com'],telegrams:['alex'],experience:'20 лет',professionAbout:'Описание'};
const workplace={name:'Бьюти тория',from:'12:00',to:'21:00',city:'Москва'};
const profileAppearance=profileCardAppearance(profile);
const profileFields=profileCardFields(profile,[workplace]);
assert.equal(profileAppearance.lines[0].field,'workTime');
assert.equal(profileAppearance.lines[1].field,'workplaceName');
assert.equal(profileAppearance.lines[6].field,'name');
assert.equal(profileAppearance.lines[7].field,'profession');
assert.equal(profileAppearance.lines[8].field,'phone');
assert.ok(profileFields.some((item)=>item.value==='email'&&item.text==='a@example.com'));
assert.ok(profileFields.some((item)=>item.value==='telegram'&&item.text==='alex'));

const workplaceAppearance=workplaceCardAppearance(workplace);
const workplaceFields=workplaceCardFields(workplace,profile);
assert.equal(workplaceAppearance.lines.length,9);
assert.ok(workplaceFields.some((item)=>item.value==='profileName'));
assert.ok(workplaceFields.some((item)=>item.value==='profileEmail'&&item.text==='a@example.com'));

const html=entityVisualCard({appearance:profileAppearance,fields:profileFields});
assert.match(html,/entity-visual-card/);
assert.match(html,/12:00 - 21:00/);
assert.match(html,/Бьюти тория/);
assert.match(html,/Александр Волоковых/);
assert.equal((html.match(/data-entity-card-line=/g)||[]).length,9);

const css=fs.readFileSync(new URL('../ui/cards/entity-card-constructor.css',import.meta.url),'utf8');
assert.match(css,/width:min\(338px,100%\)/);
assert.match(css,/aspect-ratio:338\/213/);
assert.match(css,/v2-profile-workplaces>\.entity-visual-card/);

const profileSource=fs.readFileSync(new URL('../settings/profile/profile.js',import.meta.url),'utf8');
const workplaceSource=fs.readFileSync(new URL('../settings/profile/workplaces/workplaces.js',import.meta.url),'utf8');
const constructorSource=fs.readFileSync(new URL('../ui/cards/entity-card-constructor.js',import.meta.url),'utf8');
const v2Source=fs.readFileSync(new URL('../ui/v2/index.js',import.meta.url),'utf8');
const inputCss=fs.readFileSync(new URL('../ui/inputs/inputs.css',import.meta.url),'utf8');
const colorSource=fs.readFileSync(new URL('../ui/colors/index.js',import.meta.url),'utf8');

assert.match(profileSource,/entityVisualCard\(/);
assert.doesNotMatch(profileSource,/entity-card--hero/);
assert.match(profileSource,/mountV2ZLayer\(root,v2ZLayer/);
assert.match(profileSource,/\{stack:true\}/);
assert.doesNotMatch(profileSource,/modal--entity-card-constructor/);
assert.match(profileSource,/layer\.v2Close\?\.\(\)/);

assert.match(workplaceSource,/mountV2ZLayer\(root,v2ZLayer/);
assert.match(workplaceSource,/\{stack:true\}/);
assert.doesNotMatch(workplaceSource,/modal--entity-card-constructor/);

assert.match(constructorSource,/select\(\{/);
assert.match(constructorSource,/colorPicker\(\{/);
assert.match(constructorSource,/rangeField\(\{/);
assert.match(constructorSource,/data-v2-primary-action/);
assert.match(constructorSource,/data-card-photo-select/);
assert.doesNotMatch(constructorSource,/type="color"/);

assert.match(v2Source,/data-v2-stage-gesture-ignore/);
assert.match(v2Source,/forceNavigation = Number\(event\.clientX \|\| 0\) <= Number\(rect\?\.left \|\| 0\) \+ 36/);
assert.doesNotMatch(v2Source,/event\.target\.closest\?\.\('button,input,select,textarea,label/);
assert.match(inputCss,/background:#ffff00/);
assert.match(inputCss,/::-webkit-slider-thumb/);
assert.match(colorSource,/#FFFF00/);
assert.match(colorSource,/#FF1111/);
assert.match(colorSource,/variant: 'bottom'/);

console.log('entity card constructor tests passed');
