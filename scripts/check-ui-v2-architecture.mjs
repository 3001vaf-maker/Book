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
const finance = fs.readFileSync('main/finance/finance.js', 'utf8');
const journal = fs.readFileSync('journal/journal.js', 'utf8');
const settings = fs.readFileSync('settings/settings.js', 'utf8');
const firstRun = fs.readFileSync('first-run/runtime.js', 'utf8');

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
expect(css.includes('--v2-z-open-x:min(33.333vw,130px)') && css.includes('--v2-deck-width:calc(var(--v2-z-open-x) - var(--v2-gap))') && css.includes('--v2-gap:20px'), 'Opened Z must move about one third of the app width while F remains smaller and separated by H.');
expect(css.includes('--v2-deck-top:34px') && css.includes('top:var(--v2-deck-top)'), 'F must start lower than Z to preserve layer hierarchy.');
expect(css.includes('opacity:0') && css.includes('.v2-app.is-deck-open .v2-deck') && css.includes('.v2-app.is-revealing-deck .v2-deck'), 'Closed F must disappear into H and reveal physically during Z swipe.');
expect(css.includes('box-shadow:-18px 12px 34px rgba(0,0,0,.18)') && css.includes('cubic-bezier(.22,.78,.18,1)'), 'Opened Z must read as the floating face of the active F card.');
expect(css.includes('border:1px solid rgba(17,17,17,.32)') && css.includes('inset -1px 0 0 rgba(17,17,17,.12)'), 'F cards must keep a visible contour so adjacent layers do not merge.');
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
expect(ui.includes('const activeIndex = Math.max(0, values.findIndex') && ui.includes('const visualDepth = (index - activeIndex + count) % count') && ui.includes('const depthStepX = count > 1 ? Math.min(10, 18 / (count - 1)) : 0') && ui.includes('const depthY = visualDepth * 8'), 'F must render every existing folder as a visible cyclic stack behind the active folder.');
expect(ui.includes('.slice(0, 7)') && ui.includes('data-v2-f-level="F${index + 1}"'), 'F deck must support the explicit F1-F7 hierarchy.');
expect(ui.includes('const direction = finalDx < 0 ? 1 : -1') && ui.includes('const nextIndex = (activeIndex + direction + cards.length) % cards.length') && ui.includes("'is-cycling-under'"), 'F paging must move exactly one folder and wrap as a physical cyclic deck.');
expect(ui.includes('threshold = 42') && ui.includes('settleTimer = setTimeout') && ui.includes('}, 210);'), 'F paging must use a forgiving snap threshold and finish the card-under-stack motion before rerender.');
expect(css.includes('box-shadow:-9px 8px 14px -11px rgba(0,0,0,.34)') && css.includes('.v2-z .entity-card{transform:translateY(-2px)') && css.includes('.v2-rail-card{') && css.includes('transform:translateY(-2px)'), 'Z stickers must lift at the edges while large cards float above the Z surface.');
expect(css.includes('touch-action:pan-y'), 'Shared V2 surfaces must allow vertical scrolling without fighting horizontal swipe.');
expect(account.includes("state.accountTab = id === 'history' ? 'history' : 'representatives';"), 'Changing the active F folder must immediately change Z to that folder face while the deck stays open.');
expect(accountMobileCss.includes('background:var(--v2-base)'), 'Public booking shell safe area must continue the H base.');
expect(core.includes("setThemeColor('#2F3338')") && core.includes("setThemeColor('#F5F5F3')"), 'Public booking must tint browser chrome to H and restore the workspace theme afterwards.');
expect(booking.includes('v2LegalCards(') && booking.includes('v2Sticker({'), 'Legal checkpoint must use the shared sticker system.');
expect(!booking.includes('data-booking-workplaces-back') && !booking.includes('data-booking-confirm-back'), 'V2 booking flow must not restore legacy back buttons.');

expect(core.includes("className: 'v2-app--workspace'") && core.includes('secondaryDeck'), 'Professional workspace must use the shared V2 shell with optional second F deck.');
for (const marker of ["{ id: 'people', label: 'Клиенты'", "{ id: 'finance', label: 'Финансы'", "{ id: 'timetable', label: 'График'", "{ id: 'journal', label: 'Журнал'", "{ id: 'profile', label: 'Профиль'", "{ id: 'settings', label: 'Настройки'"]) {
  expect(core.includes(marker), `Workspace root F is missing ${marker}.`);
}
expect(!core.includes('bottomNavigation(') && !core.includes("renderMain } from './main/main.js'"), 'Workspace V2 must not retain legacy bottom navigation or Main hub routing.');
expect(core.includes("kind: 'chat'") && core.includes("data: 'data-v2-workspace-chat'"), 'Chat must live in Header D instead of root F.');
expect(core.includes('const aSource = contextSource;') && core.includes('function syncWorkspaceBack(') && !core.includes("kind: backSource ? 'back' : 'settings'"), 'Workspace Header A must stay contextual; local Back must remain inside Z instead of taking A.');
expect(core.includes("surface.querySelector('.page-header-action button')") && core.includes("form button[type=\"submit\"]") && core.includes('syncWorkspacePrimarySource'), 'Workspace Header C must reuse the existing primary action instead of duplicating module logic.');
expect(css.includes('.v2-workspace-source-hidden{display:none!important}') && css.includes('.v2-workspace-back{'), 'Workspace V2 must hide only the proxied original action and keep local Back on the Z surface.');
expect(ui.includes("secondaryDeck = ''") && ui.includes("role = ''") && ui.includes('data-v2-deck-role'), 'Shared V2 must own both F levels through the same deck component.');
expect(css.includes('.v2-app--workspace .v2-deck--secondary{left:var(--v2-z-open-x)}') && css.includes('--v2-z-double-open-x:'), 'Workspace F2 must be separated from F1 by the shared GAP and move Z farther right.');
expect(css.includes('.v2-app--workspace.is-deck-open .v2-deck--secondary + .v2-z'), 'Workspace Z double shift must be structurally bound to a real second F deck, not only to a helper class.');
expect(finance.includes('export function financeNavigationItems()') && finance.includes('export function renderFinanceSection('), 'Finance F2 must route to the existing Finance screens.');
for (const label of ['Касса', 'ДДС', 'Доход / Расход', 'Статьи', 'Прочие операции', 'Z-отчёт']) expect(finance.includes(`label: '${label}'`), `Finance F2 is missing ${label}.`);
expect(journal.includes('export function journalNavigationItems()') && journal.includes('export function renderJournalView(') && journal.includes('externalNavigation'), 'Journal F2 must route the existing Day/Month/List views without duplicating them.');
expect(settings.includes('export function settingsNavigationItems()') && settings.includes('export async function renderSettingsSection(') && settings.includes("key !== 'profile'"), 'Settings F2 must route existing settings children while Profile stays a root F folder.');
expect(firstRun.includes("return 'people';") && firstRun.includes("return 'finance';") && firstRun.includes('data-v2-secondary-item'), 'DEMO navigation must follow the migrated V2 workspace entry points without changing its business progression.');
expect(firstRun.includes("book:v2-navigation-request") && firstRun.includes('this.navTarget(step)'), 'DEMO must reveal the real V2 deck before pointing to a root or second-level folder.');
expect(finance.includes('openFinanceOperation(root, movements, element.dataset.financeOperation, onBack)'), 'Finance DDS must preserve its F2 back callback through operation detail/cancel refresh.');

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
