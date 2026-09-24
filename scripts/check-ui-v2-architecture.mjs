import fs from 'node:fs';

const ui = fs.readFileSync('ui/v2/index.js', 'utf8');
const css = fs.readFileSync('ui/v2/v2.css', 'utf8');
const facade = fs.readFileSync('ui/ui.js', 'utf8');
const booking = fs.readFileSync('online-booking/booking.js', 'utf8');
const account = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const calendar = fs.readFileSync('ui/calendar/calendar.css', 'utf8');
const personalData = fs.readFileSync('online-booking/personal-data.js', 'utf8');
const passwordSettings = fs.readFileSync('online-booking/password-settings.js', 'utf8');
const consentSettings = fs.readFileSync('online-booking/consent-settings.js', 'utf8');
const inputs = fs.readFileSync('ui/inputs/index.js', 'utf8');
const accountMobileCss = fs.readFileSync('ui/shell/account-mobile.css', 'utf8');
const core = fs.readFileSync('core.js', 'utf8');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

for (const name of [
  'v2Header',
  'v2EList',
  'v2FDeck',
  'v2Shell',
  'v2ServiceStickers',
  'v2Sticker',
  'v2Document',
  'v2LegalCards',
  'v2Layer',
  'initV2Swipe',
  'initV2StickerSwipe',
  'initV2DeckSwipe',
]) {
  expect(ui.includes(`export function ${name}`), `Shared UI V2 owner must export ${name}().`);
  expect(facade.includes(name), `ui/ui.js must expose ${name}().`);
}

expect(css.includes('--v2-base:#2F3338'), 'V2 BASE must remain #2F3338.');
expect(/\.v2-z\{[\s\S]*?border-radius:var\(--v2-z-radius\) 0 0 0/.test(css), 'Z may round only the upper-left corner.');
expect(/\.v2-layer--quick\{[\s\S]*?border-radius:0/.test(css), 'QUICK must remain rectangular.');
expect(/\.v2-layer--standard\{[\s\S]*?border-radius:0/.test(css), 'STANDARD must remain rectangular.');
expect(/\.v2-layer--system\{[\s\S]*?border-radius:var\(--v2-z-radius\) 0 0 0/.test(css), 'SYSTEM may repeat only the upper-left UZ corner.');
expect(/\.v2-deck__card\{[\s\S]*?border-radius:0 var\(--v2-z-radius\) 0 0/.test(css), 'F cards must mirror Z toward the left.');
expect(css.includes('--v2-deck-width:min(33vw,128px)') && css.includes('--v2-gap:20px') && css.includes('--v2-z-open-x:calc(var(--v2-deck-width) + var(--v2-gap))'), 'F must stay smaller than Z and leave a real H GAP before opened Z.');
expect(css.includes('--v2-deck-top:34px') && css.includes('top:var(--v2-deck-top)'), 'F must start lower than Z to preserve layer hierarchy.');
expect(css.includes('opacity:0') && css.includes('.v2-app.is-deck-open .v2-deck') && css.includes('.v2-app.is-revealing-deck .v2-deck'), 'Closed F must disappear into H and reveal physically during Z swipe.');
expect(css.includes('box-shadow:-14px 10px 30px rgba(0,0,0,.16)') && css.includes('cubic-bezier(.22,.78,.18,1)'), 'Z/F movement must keep restrained physical depth and eased motion.');
expect(css.includes('border:1px solid rgba(17,17,17,.28)') && css.includes('inset -1px 0 0 rgba(17,17,17,.10)'), 'F cards must keep a visible contour so adjacent beige layers do not merge.');
expect(css.includes('transform:rotate(-90deg)') && css.includes('transform-origin:left bottom'), 'F folder names must read vertically from bottom to top.');
expect(css.includes('.v2-e-list{') && css.includes('flex-direction:column'), 'E must remain a distinct long vertical list, not F geometry.');
expect(css.includes('.v2-legal-cards{display:grid;gap:12px}'), 'Legal document cards must have an explicit equal gap.');
expect(css.includes('.v2-legal-card{\n  height:96px;'), 'Legal document cards must share one base height.');
expect(css.includes('.booking-account--account .v2-app .booking-time-grid{grid-template-columns:repeat(3,minmax(0,1fr))}'), 'V2 time slots must stay three per row.');
expect(css.includes('.booking-account--account .v2-app .booking-time-slot{border-radius:0'), 'V2 time slots must remain rectangular.');
expect(!/\.booking-account--account \.v2-app \.calendar__date\{[^}]*border-radius/.test(css), 'V2 must not redesign Calendar geometry.');
expect(calendar.includes('.calendar__grid') && calendar.includes('.calendar__month-button'), 'Canonical Calendar owner must remain intact.');

expect(booking.includes('v2ServiceStickers('), 'Booking services must use shared compact V2 stickers.');
expect(inputs.includes('export function passwordField') && inputs.includes('export function initPasswordFields'), 'Password reveal control must belong to shared UI inputs.');
expect(booking.includes('passwordField({') && booking.includes('initPasswordFields(root)'), 'Auth and Registration must use the shared password reveal control.');
expect(booking.includes("step: 'workplaces'") && booking.includes("step: 'confirmation'"), 'Booking must remain a V2 Z-stack flow.');
expect(booking.includes('initV2Swipe(root'), 'Booking Z-stack must use the shared physical swipe.');
expect(ui.includes("axis = Math.abs(nextX) > Math.abs(nextY) * 1.25 ? 'horizontal' : 'vertical'"), 'Shared V2 swipe must axis-lock before moving the surface.');
expect(ui.includes("app?.classList.add('is-revealing-deck')") && ui.includes("app?.classList.remove('is-revealing-deck')"), 'Z swipe must reveal and reset the F stack physically.');
expect(ui.includes('const activeIndex = Math.max(0, values.findIndex') && ui.includes('const relation = index - activeIndex') && ui.includes('const depthX = visualDepth * 16') && ui.includes('const depthY = visualDepth * 16'), 'F cards must keep a linear F1-F7 hierarchy relative to the active folder.');
expect(ui.includes('.slice(0, 7)') && ui.includes('data-v2-f-level="F${index + 1}"'), 'F deck must support the explicit F1-F7 hierarchy.');
expect(ui.includes('const nextIndex = finalDx < 0 ? activeIndex + 1 : activeIndex - 1') && !ui.includes('(activeIndex + direction + cards.length) % cards.length'), 'F paging must move exactly one level and must not wrap cyclically.');
expect(ui.includes('threshold = 42') && ui.includes('requested * 0.22'), 'F paging must use a forgiving snap threshold with edge resistance.');
expect(css.includes('touch-action:pan-y'), 'Shared V2 surfaces must allow vertical scrolling without fighting horizontal swipe.');
expect(accountMobileCss.includes('background:var(--v2-base)'), 'Public booking shell safe area must continue the H base.');
expect(core.includes("setThemeColor('#2F3338')") && core.includes("setThemeColor('#F5F5F3')"), 'Public booking must tint browser chrome to H and restore the workspace theme afterwards.');
expect(booking.includes('v2LegalCards(') && booking.includes('v2Sticker({'), 'Legal checkpoint must use the shared sticker system.');
expect(!booking.includes('data-booking-workplaces-back') && !booking.includes('data-booking-confirm-back'), 'V2 booking flow must not restore legacy back buttons.');

expect(account.includes('v2FDeck('), 'End-user root must use shared F deck.');
expect(account.includes('initV2DeckSwipe(root'), 'End-user F deck must page horizontally with the shared interaction.');
expect(account.includes("className: 'v2-app--chat'"), 'End-user Chat must share V2 H + Z geometry.');
expect(account.includes("attachmentTrigger: 'external'"), 'Chat attachment action must live in Header D.');
expect(!account.includes('accountBottomNavigation') && !account.includes('bindBottomNavigation'), 'End-user V2 must not contain bottom navigation.');
expect(!account.includes('<style>') && !booking.includes('<style>'), 'Feature code must not create local V2 style owners.');
for (const [name, source] of [['personal-data', personalData], ['password-settings', passwordSettings], ['consent-settings', consentSettings]]) {
  expect(source.includes('v2Layer') && source.includes('mountV2Layer'), `${name} must use shared V2 layers.`);
  expect(!source.includes('mountModal(') && !source.includes('modal('), `${name} must not reopen the legacy rounded modal shell.`);
}

if (failures.length) {
  failures.forEach((message) => console.error(`ui v2 architecture: ${message}`));
  process.exit(1);
}

console.log('ui v2 architecture check: OK');
