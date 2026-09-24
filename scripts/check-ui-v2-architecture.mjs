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
const modals = fs.readFileSync('ui/modals/index.js', 'utf8');
const headerUi = fs.readFileSync('ui/header/index.js', 'utf8');
const timeUi = fs.readFileSync('ui/time/index.js', 'utf8');
const colorUi = fs.readFileSync('ui/colors/index.js', 'utf8');
const workplacesUi = fs.readFileSync('settings/profile/workplaces/workplaces.js', 'utf8');
const accountControlsUi = fs.readFileSync('settings/profile/account-controls.js', 'utf8');
const accountMobileCss = fs.readFileSync('ui/shell/account-mobile.css', 'utf8');
const core = fs.readFileSync('core.js', 'utf8');
const finance = fs.readFileSync('main/finance/finance.js', 'utf8');
const journal = fs.readFileSync('journal/journal.js', 'utf8');
const settings = fs.readFileSync('settings/settings.js', 'utf8');
const firstRun = fs.readFileSync('first-run/runtime.js', 'utf8');
const profile = fs.readFileSync('settings/profile/profile.js', 'utf8');
const style = fs.readFileSync('css/style.css', 'utf8');
const entityCardCss = fs.readFileSync('ui/cards/entity-card.css', 'utf8');

function cssFilesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return cssFilesUnder(path);
    return entry.isFile() && entry.name.endsWith('.css') ? [path] : [];
  });
}

function jsFilesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return jsFilesUnder(path);
    return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
  });
}

const sharedCssFiles = ['css/style.css', ...cssFilesUnder('ui'), ...cssFilesUnder('settings/profile')];
const runtimeJsFiles = [
  'core.js',
  ...jsFilesUnder('ui'),
  ...jsFilesUnder('online-booking'),
  ...jsFilesUnder('settings'),
  ...jsFilesUnder('main'),
  ...jsFilesUnder('journal'),
  ...jsFilesUnder('first-run'),
];

const legacySystemBrown = /#(?:3B302B|7A6F69|B8AEA8|E7E1DB|E8E1DC|D7CEC7|968982|E9E6E2|D8D0CA)\b|rgba\(59,48,43,[^)]+\)|rgba\(30,25,22,[^)]+\)/i;

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
for (const file of sharedCssFiles) {
  expect(!legacySystemBrown.test(fs.readFileSync(file, 'utf8')), `Legacy system brown must not remain in Shared UI CSS: ${file}.`);
}
for (const file of runtimeJsFiles) {
  if (file === 'ui/v2/index.js' || file === 'ui/modals/index.js') continue;
  const source = fs.readFileSync(file, 'utf8');
  expect(!/\b(?:v2Layer|mountV2Layer)\s*\(/.test(source), `Runtime code must use canonical modal()/mountModal() instead of parallel V2 modal primitives: ${file}.`);
}


for (const name of [
  'v2Header',
  'v2EList',
  'v2FDeck',
  'v2Shell',
  'v2ServiceStickers',
  'v2Sticker',
  'v2Document',
  'v2LegalCards',
  'v2ZLayer',
  'mountV2ZLayer',
  'initV2Swipe',
  'initV2StickerSwipe',
  'initV2DeckSwipe',
]) {
  expect(ui.includes(`export function ${name}`), `Shared UI V2 owner must export ${name}().`);
  expect(facade.includes(name), `ui/ui.js must expose ${name}().`);
}

expect(css.includes('--v2-base:var(--surface-dark)') && style.includes('--surface-dark:#2F3338'), 'V2 BASE must resolve through the shared H dark-surface token #2F3338.');
expect(/\.v2-z\{[\s\S]*?border-radius:var\(--v2-z-radius\) 0 0 0/.test(css), 'Z may round only the upper-left corner.');
expect(/\.v2-layer--quick\{[\s\S]*?border-radius:0/.test(css), 'QUICK must remain rectangular.');
expect(/\.v2-layer--standard\{[\s\S]*?border-radius:0/.test(css), 'STANDARD must remain rectangular.');
expect(/\.v2-layer--system\{[\s\S]*?border-radius:var\(--v2-z-radius\) 0 0 0/.test(css), 'SYSTEM may repeat only the upper-left UZ corner.');
expect(/\.v2-deck__card\{[\s\S]*?border-radius:0 var\(--v2-z-radius\) 0 0/.test(css), 'F cards must mirror Z toward the left.');
expect(css.includes('--v2-z-open-x:min(33.333vw,130px)') && css.includes('--v2-deck-width:calc(var(--v2-z-open-x) - var(--v2-gap))') && css.includes('--v2-gap:20px'), 'Opened Z must move about one third of the app width while F remains smaller and separated by H.');
expect(css.includes('--v2-deck-top:34px') && css.includes('top:var(--v2-deck-top)'), 'F must start lower than Z to preserve layer hierarchy.');
expect(css.includes('opacity:0') && css.includes('.v2-app.is-deck-open .v2-fe-deck') && css.includes('.v2-app.is-revealing-deck .v2-fe-deck'), 'Closed FE must disappear into H and reveal physically during Z1 swipe.');
expect(css.includes('box-shadow:-18px 12px 34px rgba(0,0,0,.18)') && css.includes('cubic-bezier(.22,.78,.18,1)'), 'Opened Z must read as the floating face of the active F card.');
expect(css.includes('border:1px solid rgba(17,17,17,.32)') && css.includes('inset -1px 0 0 rgba(17,17,17,.12)'), 'F cards must keep a visible contour so adjacent layers do not merge.');
expect(/\.v2-deck__card\{[\s\S]*?display:grid;[\s\S]*?place-items:center/.test(css) && /\.v2-deck__card strong\{[\s\S]*?text-align:center/.test(css) && !css.includes('transform:rotate(-90deg)'), 'F folder names must be centered and readable on each F card.');
expect(/\.v2-e-card\{[\s\S]*?height:50%;[\s\S]*?place-items:center/.test(css) && css.includes('--v2-e-pull:') && css.includes('.v2-app.is-deck-open .v2-e-card'), 'E must be a shorter nested card deck that slides out from under F.');
expect(css.includes('.v2-legal-cards{display:flex;gap:10px;overflow-x:auto'), 'Legal document stickers must use the shared horizontal rail.');
expect(css.includes('.v2-legal-card{\n  flex:0 0 min(86%,320px);\n  height:96px;'), 'Legal document stickers must share one base height and horizontal width.');
expect(css.includes('.booking-account--account .v2-app .booking-time-grid{grid-template-columns:repeat(3,minmax(0,1fr))}'), 'V2 time slots must stay three per row.');
expect(css.includes('.booking-account--account .v2-app .booking-time-slot{border-radius:0'), 'V2 time slots must remain rectangular.');
expect(!/\.booking-account--account \.v2-app \.calendar__date\{[^}]*border-radius/.test(css), 'V2 must not redesign Calendar geometry.');
expect(calendar.includes('.calendar__grid') && calendar.includes('.calendar__month-button'), 'Canonical Calendar owner must remain intact.');

expect(booking.includes('v2ServiceStickers('), 'Booking services must use shared compact V2 stickers.');
expect(inputs.includes('export function passwordField') && inputs.includes('export function initPasswordFields'), 'Password reveal control must belong to shared UI inputs.');
expect(booking.includes('passwordField({') && booking.includes('initPasswordFields(root)'), 'Auth and Registration must use the shared password reveal control.');
expect(booking.includes("step: 'workplaces'") && booking.includes("step: 'confirmation'"), 'Booking must remain a V2 Z-stack flow.');
expect(booking.includes('initV2Swipe(root'), 'Booking Z-stack must use the shared physical swipe.');
expect(ui.includes("axis = Math.abs(nextX) >= Math.abs(nextY) * 1.08 ? 'horizontal' : 'vertical'"), 'Shared Z swipe must axis-lock without randomly rejecting a horizontal gesture.');
expect(ui.includes("app?.classList.add('is-revealing-deck')") && ui.includes("app?.classList.remove('is-revealing-deck')"), 'Z swipe must reveal and reset the F stack physically.');
expect(ui.includes('const activeIndex = Math.max(0, values.findIndex') && ui.includes('const visualDepth = (index - activeIndex + count) % count') && ui.includes('const depthStepX = count > 1 ? Math.min(10, 18 / (count - 1)) : 0') && ui.includes('const depthY = visualDepth * 8'), 'F must render every existing folder as a visible cyclic stack behind the active folder.');
expect(ui.includes('.slice(0, 7)') && ui.includes('data-v2-f-index="${index}"') && !ui.includes('data-v2-f-level'), 'F cards must be peer folders with real names, not visual F1/F2/F3 levels.');
expect(ui.includes('const nextIndex = (activeIndex + direction + cards.length) % cards.length') && ui.includes('commit(finalDx < 0 ? 1 : -1)') && ui.includes("'is-next-ready'"), 'F paging must reveal the next folder immediately under the outgoing physical card.');
expect(ui.includes('threshold = 42') && ui.includes("addEventListener('transitionend'") && ui.includes('requestAnimationFrame') && !ui.includes('settleTimer') && !ui.includes('}, 210);'), 'F paging must continue from the finger into one transition without the legacy 210 ms reset/pause/rerender sequence.');
expect(css.includes('box-shadow:-9px 8px 14px -11px rgba(0,0,0,.34)') && css.includes('.v2-z .entity-card{transform:translateY(-2px)') && css.includes('.v2-rail-card{') && css.includes('transform:translateY(-2px)'), 'Z stickers must lift at the edges while large cards float above the Z surface.');
expect(css.includes('touch-action:pan-y'), 'Shared V2 surfaces must allow vertical scrolling without fighting horizontal swipe.');
expect(account.includes("state.accountTab = id === 'history' ? 'history' : 'representatives';"), 'Changing the active F folder must immediately change Z to that folder face while the deck stays open.');
expect(accountMobileCss.includes('background:var(--v2-base)'), 'Public booking shell safe area must continue the H base.');
expect(core.includes("setThemeColor('#2F3338')") && core.includes("setThemeColor('#F5F5F3')"), 'Public booking must tint browser chrome to H and restore the workspace theme afterwards.');
expect(booking.includes('v2LegalCards(') && booking.includes('v2Sticker({'), 'Legal checkpoint must use the shared sticker system.');
expect(!booking.includes('data-booking-workplaces-back') && !booking.includes('data-booking-confirm-back'), 'V2 booking flow must not restore legacy back buttons.');

expect(core.includes("className: 'v2-app--workspace'") && core.includes('v2EList(childItems') && core.includes('eDeck,'), 'Professional workspace must render second-level navigation as E inside the shared FE shell.');
for (const marker of ["{ id: 'people', label: 'Клиенты'", "{ id: 'finance', label: 'Финансы'", "{ id: 'timetable', label: 'График'", "{ id: 'journal', label: 'Журнал'", "{ id: 'profile', label: 'Профиль'", "{ id: 'settings', label: 'Настройки'"]) {
  expect(core.includes(marker), `Workspace root F is missing ${marker}.`);
}
expect(!core.includes('bottomNavigation(') && !core.includes("renderMain } from './main/main.js'"), 'Workspace V2 must not retain legacy bottom navigation or Main hub routing.');
expect(core.includes("kind: 'chat'") && core.includes("data: 'data-v2-workspace-chat'"), 'Chat must live in Header D instead of root F.');
expect(core.includes("[data-workspace-context-action]") && core.includes('aSource.dataset.workspaceAKind') && core.includes('function syncWorkspaceBack(') && !core.includes("kind: backSource ? 'back' : 'settings'"), 'Workspace Header A must consume the canonical Header context; local Back must remain inside Z instead of taking A.');
expect(core.includes("[data-v2-primary-action]") && core.includes("surface.querySelector('.page-header-action button')") && core.includes("form button[type=\"submit\"]") && core.includes('syncWorkspacePrimarySource'), 'Workspace Header C must reuse the shared or existing primary action instead of duplicating module logic.');
expect(css.includes('.v2-workspace-source-hidden{display:none!important}') && css.includes('.v2-workspace-back{'), 'Workspace V2 must hide only the proxied original action and keep local Back on the Z surface.');
expect(css.includes('.v2-primary-source-only{display:none!important}'), 'Header C may proxy a single hidden source without duplicating the visible action in Z body.');
expect(ui.includes("eDeck = ''") && ui.includes('class="v2-fe-deck"') && ui.includes('data-v2-fe'), 'Shared V2 shell must own F and its nested E as one FE deck.');
expect(css.includes('.v2-e-deck{') && css.includes('.v2-app.has-e-deck.is-deck-open > .v2-app__stage > .v2-z:not(.v2-z--layer)') && !css.includes('.v2-deck--secondary') && !css.includes('--v2-z-double-open-x:'), 'E must remain nested under F instead of becoming a second F strip.');
expect(css.includes('.v2-app.is-deck-open > .v2-app__stage > .v2-z:not(.v2-z--layer)') && ui.includes('const isTopmost = () =>') && ui.includes('return layers.length === 0;'), 'Deck-open state may move only Z1; Z2 must remain independent and own the topmost swipe.');
expect(finance.includes('export function financeNavigationItems()') && finance.includes('export function renderFinanceSection('), 'Finance E navigation must route to the existing Finance screens.');
for (const label of ['Касса', 'ДДС', 'Доход / Расход', 'Статьи', 'Прочие операции', 'Z-отчёт']) expect(finance.includes(`label: '${label}'`), `Finance E is missing ${label}.`);
expect(journal.includes('export function journalNavigationItems()') && journal.includes('export function renderJournalView(') && journal.includes('externalNavigation'), 'Journal E must route the existing Day/Month/List views without duplicating them.');
expect(settings.includes('export function settingsNavigationItems()') && settings.includes('export async function renderSettingsSection(') && settings.includes("key !== 'profile'"), 'Settings E must route existing settings children while Profile stays a root F folder.');
expect(firstRun.includes("return 'people';") && firstRun.includes("return 'finance';") && firstRun.includes('data-v2-secondary-item'), 'DEMO navigation must follow the migrated V2 workspace entry points without changing its business progression.');
expect(firstRun.includes("book:v2-navigation-request") && firstRun.includes('this.navTarget(step)'), 'DEMO must reveal the real V2 deck before pointing to a root or second-level folder.');
expect(finance.includes('openFinanceOperation(root, movements, element.dataset.financeOperation, onBack)'), 'Finance DDS must preserve its E back callback through operation detail/cancel refresh.');

expect(profile.includes('workspaceHeaderContext({') && profile.includes("hideD:true") && profile.includes("kind:'avatar'"), 'Profile must feed Header A/B/D through the canonical Header owner.');
expect(profile.includes("v2Section('Рабочие пространства',workplaceRail())") && profile.includes('v2HorizontalRail('), 'Profile root Z must contain the profile card plus a horizontal workplace rail.');
expect(!profile.includes('accordion(') && !profile.includes('initAccordions('), 'Regular Profile UI must not retain the legacy accordion.');
expect(profile.includes('mountV2ZLayer(root,v2ZLayer(') && profile.includes("'Настройки профиля'"), 'Profile settings must open as a shared second Z layer.');
expect(profile.includes('data-v2-primary-action') && profile.includes('data-add-workplace'), 'Profile root C must proxy the existing add-workplace action.');

expect(profile.includes("data:'data-profile-card'") && profile.includes("openProfileData(root") && profile.includes("'Данные профиля'"), 'Profile Card must open a dedicated Profile Data Z2.');
expect(profile.includes("openProfileSettings(root") && profile.includes("'Настройки профиля'"), 'Header A must open a separate Profile Settings Z2.');
expect(profile.includes("openWorkplaceZ2(root") && profile.includes("workplaceForm(existing,{sourceOnly:true})"), 'Workplace cards and create action must use the reusable workplace form inside Z2.');
expect(profile.includes("className:'entity-card--hero entity-card--rail") && !profile.includes("entity-card--compact"), 'Workplaces in Profile must remain real Entity Cards, not compact substitutes.');
expect(profile.includes("data-v2-primary-visible=\"false\"") && profile.includes("formSnapshot(form)!==initial"), 'Profile Data C=Save must appear reactively only after changes.');
expect(workplacesUi.includes("data-v2-primary-label=\"") && workplacesUi.includes("existing&&!dirty?'Удалить':'Сохранить'"), 'Existing Workplace Z2 C must switch between Delete and Save based on dirty state.');
expect(workplacesUi.includes("workplaceForm(existing,{bodyActions:true})") && workplacesUi.includes("workplaceForm(existing=null,{sourceOnly=false,bodyActions=false}={})"), 'Workplace must have one reusable form renderer with compatibility wrappers, not a second V2 form.');
expect(css.includes('--v2-z-layer-offset:12px') && css.includes('inset:0 0 0 calc(var(--v2-edge) + var(--v2-z-layer-offset))'), 'Shared Z2 must leave a single 12px Z1 edge through the shared token.');
expect(ui.includes("[data-v2-z], [data-v2-z-layer]") && ui.includes("revealDeck: false"), 'Shared swipe must own Z2 and close it without revealing F.');
expect(accountControlsUi.includes("data-service-email") && accountControlsUi.includes("data-service-push") && accountControlsUi.includes("data-service-telegram"), 'Profile Settings must expose Telegram, Email and Push service channels.');
expect(!accountControlsUi.includes('История согласий') && !accountControlsUi.includes('historyMarkup') && !accountControlsUi.includes('openConsentHistory') && !accountControlsUi.includes('data-consent-history'), 'Profile Settings must not expose consent history.');

expect(style.includes('--text:#111111') && style.includes('--button-secondary:#D8D3CF') && style.includes('--text-secondary:#777A7D'), 'Shared palette must use the approved black and neutral tokens.');
expect(entityCardCss.includes('--entity-card-h:var(--v2-base,var(--surface-dark))') && entityCardCss.includes('--entity-card-neutral:var(--v2-disabled,var(--button-secondary))') && entityCardCss.includes('linear-gradient(135deg,var(--entity-card-h) 0%,var(--entity-card-neutral) 100%)') && !/#D7CEC7|#968982|#E7E1DB|#B8AEA8|rgba\(59,48,43/.test(entityCardCss), 'Shared entity cards must use the canonical H-to-neutral gradient without legacy brown.');
expect(inputs.includes('data-photo-crop-x-value') && inputs.includes('data-photo-crop-y-value') && inputs.includes('setOriginal(src)') && !inputs.includes('croppedSquare('), 'Shared photo owner must preserve the original image and store crop position metadata instead of replacing the original with a cropped blob.');
expect(headerUi.includes('export function workspaceHeaderContext') && facade.includes('workspaceHeaderContext'), 'Canonical Header owner must own workspace context metadata.');
expect(!ui.includes('v2WorkspaceContext'), 'Shared V2 must not duplicate the canonical Header context owner.');
expect(ui.includes('export function v2ZLayer') && ui.includes('export function mountV2ZLayer'), 'Shared V2 must own stacked Z layers.');
expect(ui.includes('export function v2Layer') && ui.includes('export function mountV2Layer'), 'Shared V2 may keep modal geometry primitives internally for ui/modals.');
expect(!facade.includes('v2Layer') && !facade.includes('mountV2Layer'), 'ui/ui.js must not expose internal V2 modal primitives alongside the canonical modal owner.');
expect(core.includes('activeWorkspaceSurface(surface)') && core.includes("context?.dataset.workspaceHideD === 'true'") && core.includes("[data-workspace-context-action]"), 'Workspace Header must follow the top Z layer and consume the canonical Header context owner.');

expect(modals.includes("import { mountV2Layer, v2Layer } from '../v2/index.js';")
  && modals.includes('v2Layer(content')
  && modals.includes('mountV2Layer(html)')
  && !modals.includes('<div class="modal-backdrop"'),
  'ui/modals must be a compatibility facade over the single shared V2 layer owner, not a parallel modal shell.');
for (const [name, source] of [
  ['profile', profile],
  ['profile workplaces', workplacesUi],
  ['profile account controls', accountControlsUi],
  ['shared time', timeUi],
  ['shared colors', colorUi],
  ['end-user account shell', account],
  ['personal-data', personalData],
  ['password-settings', passwordSettings],
  ['consent-settings', consentSettings],
]) {
  expect(source.includes('modal(') && source.includes('mountModal('), `${name} must consume the sole shared modal owner.`);
  expect(!source.includes('mountV2Layer(') && !source.includes('v2Layer('), `${name} must not bypass ui/modals with a parallel V2 modal path.`);
}
expect(!inputs.includes('modal(') && !inputs.includes('mountModal('), 'Shared photo/input owner must keep crop inline and must not open a modal.');
expect(!inputs.includes('mountV2Layer(') && !inputs.includes('v2Layer('), 'Shared inputs must not bypass canonical owners with local V2 layers.');



expect(account.includes('v2FDeck('), 'End-user root must use shared F deck.');
expect(account.includes('initV2DeckSwipe(root'), 'End-user F deck must page horizontally with the shared interaction.');
expect(account.includes("className: 'v2-app--chat'"), 'End-user Chat must share V2 H + Z geometry.');
expect(account.includes("attachmentTrigger: 'external'"), 'Chat attachment action must live in Header D.');
expect(!account.includes('accountBottomNavigation') && !account.includes('bindBottomNavigation'), 'End-user V2 must not contain bottom navigation.');
expect(!account.includes('<style>') && !booking.includes('<style>'), 'Feature code must not create local V2 style owners.');

if (failures.length) {
  failures.forEach((message) => console.error(`ui v2 architecture: ${message}`));
  process.exit(1);
}

console.log('ui v2 architecture check: OK');
