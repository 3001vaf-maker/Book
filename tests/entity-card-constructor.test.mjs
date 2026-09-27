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

const profile={name:'Александр',surname:'Волоковых',profession:'Парикмахер',phone:'+79104193490'};
const workplace={name:'Бьюти тория',from:'12:00',to:'21:00',city:'Москва'};
const profileAppearance=profileCardAppearance(profile);
const profileFields=profileCardFields(profile,[workplace]);
assert.equal(profileAppearance.lines[0].field,'workTime');
assert.equal(profileAppearance.lines[1].field,'workplaceName');
assert.equal(profileAppearance.lines[6].field,'name');
assert.equal(profileAppearance.lines[7].field,'profession');
assert.equal(profileAppearance.lines[8].field,'phone');

const workplaceAppearance=workplaceCardAppearance(workplace);
const workplaceFields=workplaceCardFields(workplace,profile);
assert.equal(workplaceAppearance.lines.length,9);
assert.ok(workplaceFields.some((item)=>item.value==='profileName'));

const html=entityVisualCard({appearance:profileAppearance,fields:profileFields});
assert.match(html,/entity-visual-card/);
assert.match(html,/12:00 - 21:00/);
assert.match(html,/Бьюти тория/);
assert.match(html,/Александр Волоковых/);
assert.equal((html.match(/data-entity-card-line=/g)||[]).length,9);

console.log('entity card constructor tests passed');
