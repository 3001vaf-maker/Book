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
const onlineBookingSettings = fs.readFileSync('settings/online-booking/online-booking.js', 'utf8');
const onlineBookingSettingsCss = fs.readFileSync('settings/online-booking/online-booking.css', 'utf8');
const journalList = fs.readFileSync('journal/список.js', 'utf8');
const firstRun = fs.readFileSync('first-run/runtime.js', 'utf8');
const profile = fs.readFileSync('settings/profile/profile.js', 'utf8');
const style = fs.readFileSync('css/style.css', 'utf8');
const entityCardUi = fs.readFileSync('ui/cards/index.js', 'utf8');
const entityCardCss = fs.readFileSync('ui/cards/entity-card.css', 'utf8');
const buttonCss = fs.readFileSync('ui/buttons/buttons.css', 'utf8');
const segmentUi = fs.readFileSync('ui/selection/segment-control.js', 'utf8');
const segmentCss = fs.readFileSync('ui/selection/segment-control.css', 'utf8');
const infoUi = fs.readFileSync('ui/info/index.js', 'utf8');
const infoCss = fs.readFileSync('ui/info/info.css', 'utf8');
const inputsCss = fs.readFileSync('ui/inputs/inputs.css', 'utf8');
const listCss = fs.readFileSync('ui/lists/list.css', 'utf8');
const listEntryCss = fs.readFileSync('ui/lists/list-entry.css', 'utf8');
const selectorsUi = fs.readFileSync('ui/selectors/index.js', 'utf8');
const selectorsCss = fs.readFileSync('ui/selectors/selectors.css', 'utf8');
const miniCardUi = fs.readFileSync('ui/cards/mini-card.js', 'utf8');
const miniCardCss = fs.readFileSync('ui/cards/mini-card.css', 'utf8');

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
  ...jsFilesUnder('timetable'),
  ...jsFilesUnder('first-run'),
];

const workspaceJsFiles = [
  ...jsFilesUnder('settings'),
  ...jsFilesUnder('main'),
  ...jsFilesUnder('journal'),
  ...jsFilesUnder('timetable'),
];
const workspaceCssFiles = [
  ...cssFilesUnder('settings'),
  ...cssFilesUnder('main'),
  ...cssFilesUnder('journal'),
  ...cssFilesUnder('timetable'),
];

const legacySystemBrown = /#(?:3B302B|7A6F69|B8AEA8|E7E1DB|E8E1DC|D7CEC7|968982|E9E6E2|D8D0CA)\b|rgba\(59,48,43,[^)]+\)|rgba\(30,25,22,[^)]+\)/i;

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
for (const file of sharedCssFiles) {
  const source = fs.readFileSync(file, 'utf8');
  expect(!legacySystemBrown.test(source), `Legacy system brown must not remain in Shared UI CSS: ${file}.`);
  if (file !== 'ui/buttons/buttons.css') {
    expect(!/\.ui-button--(?:secondary|outline)\s*\{|\.ui-button:disabled\s*\{/.test(source), `Shared Button states must not be re-owned outside ui/buttons/buttons.css: ${file}.`);
  }
  if (file !== 'ui/selection/segment-control.css') {
    expect(!/(^|\})\.segment-control\s*\{|(^|\})\.segment-control button(?:\.is-active)?\s*\{/.test(source), `Segmented-control base styling must not be re-owned outside ui/selection/segment-control.css: ${file}.`);
  }
  if (file !== 'ui/cards/entity-card.css') {
    expect(!/--entity-card-(?:depth|mid|light|surface)\s*:/.test(source), `Entity Card surface tokens must stay owned by ui/cards/entity-card.css: ${file}.`);
  }
  if (file !== 'ui/info/info.css') {
    expect(!/\.ui-info__(?:trigger|panel)\s*\{/.test(source), `Info UI styling must stay owned by ui/info/info.css: ${file}.`);
  }
}
for (const file of runtimeJsFiles) {
  if (file === 'ui/v2/index.js' || file === 'ui/modals/index.js') continue;
  const source = fs.readFileSync(file, 'utf8');
  expect(!/\b(?:v2Layer|mountV2Layer)\s*\(/.test(source), `Runtime code must use canonical modal()/mountModal() instead of parallel V2 modal primitives: ${file}.`);
}

for (const file of runtimeJsFiles) {
  if (file === 'ui/v2/index.js' || file === 'ui/ui.js') continue;
  const source = fs.readFileSync(file, 'utf8');
  expect(!/\binitV2DeckSwipe\s*\(/.test(source), `Runtime code must not bind the removed legacy deck swipe owner: ${file}.`);
}

for (const file of workspaceJsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  expect(!/\b(?:appShell|appHeader)\s*\(/.test(source), `Workspace screens must render inside the single Shared Z shell instead of nesting a second app shell/header: ${file}.`);
  expect(!/app-content--book-shell/.test(source), `Workspace screens must not switch to a legacy full-screen shell class inside Z: ${file}.`);
}
for (const file of workspaceCssFiles) {
  const source = fs.readFileSync(file, 'utf8');
  expect(!/position\s*:\s*fixed/.test(source), `Workspace feature CSS must not create a local fixed layer above Shared Z: ${file}.`);
  expect(!/(?:min-|max-)?height\s*:\s*(?:var\(--visual-vh\s*,\s*)?100dvh/.test(source), `Workspace feature CSS must not create its own viewport-height screen inside Shared Z: ${file}.`);
  expect(!/touch-action\s*:/.test(source), `Workspace feature CSS must not re-own touch gesture policy inside Shared Z: ${file}.`);
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
  'initV2WorkspaceInteraction',
  'setV2DeckOpen',
]) {
  expect(ui.includes(`export function ${name}`), `Shared UI V2 owner must export ${name}().`);
  expect(facade.includes(name), `ui/ui.js must expose ${name}().`);
}

expect(css.includes('--v2-base:var(--surface-dark)') && style.includes('--surface-dark:#2F3338'), 'V2 BASE must resolve through the shared H dark-surface token #2F3338.');
expect(/\.v2-z\{[\s\S]*?border-radius:var\(--v2-z-radius\) 0 0 0/.test(css), 'Z may round only the upper-left corner.');
expect(/\.v2-layer--top\{[\s\S]*?border-radius:var\(--v2-z-radius\) 0 0 0/.test(css), 'TOP modal must live inside Z and repeat only the Z upper-left radius.');
expect(/\.v2-layer--standard\{[\s\S]*?inset:0;[\s\S]*?border-radius:var\(--v2-z-radius\) 0 0 0/.test(css), 'STANDARD modal must be a full-height Z-contained sheet with only the upper-left radius.');
expect(/\.v2-layer--bottom\{[\s\S]*?bottom:0;[\s\S]*?border-radius:0/.test(css), 'BOTTOM modal must stay straight inside the lower part of Z.');
expect(/\.v2-layer--technical\{[\s\S]*?top:50%;[\s\S]*?border-radius:0;[\s\S]*?box-shadow:0 18px 46px/.test(css), 'TECHNICAL modal must float above the whole system with all straight edges and an all-side shadow.');
expect(css.includes('.v2-layer-backdrop--contained{position:fixed;inset:0') && css.includes('.v2-layer-backdrop--technical{position:fixed;inset:0'), 'Shared modal geometry must distinguish Z-contained work modals from rare technical overlays.');
expect(/\.v2-deck__card\{[\s\S]*?border-radius:0 var\(--v2-z-radius\) 0 0/.test(css), 'F cards must mirror Z toward the left.');
expect(css.includes('--v2-f-open-x:min(30vw,117px)') && css.includes('--v2-fe-open-x:min(40vw,156px)') && css.includes('--v2-deck-width:calc(var(--v2-f-open-x) - var(--v2-gap))'), 'F must expose about 30% without E and the full FE hierarchy about 40% when E exists.');
expect(css.includes('--v2-deck-top:34px') && css.includes('top:var(--v2-deck-top)'), 'F must start lower than Z to preserve layer hierarchy.');
expect(css.includes('opacity:0') && css.includes('.v2-app.is-deck-open .v2-fe-deck') && css.includes('.v2-app.is-revealing-deck .v2-fe-deck'), 'Closed FE must disappear into H and reveal physically during Z1 swipe.');
expect(css.includes('.v2-front{') && css.includes('background:var(--v2-base)') && css.includes('.v2-app.is-deck-open > .v2-app__stage > .v2-front') && css.includes('box-shadow:-18px 12px 34px rgba(0,0,0,.18)'), 'H and Z must move as one front layer while FE remains behind H.');
expect(css.includes('border:1px solid rgba(17,17,17,.32)') && css.includes('inset -1px 0 0 rgba(17,17,17,.12)'), 'F cards must keep a visible contour so adjacent layers do not merge.');
expect(css.includes('--v2-card-handle:48px') && css.includes('--v2-card-handle-min:44px') && /\.v2-deck__card strong\{[\s\S]*?height:var\(--v2-card-handle\);[\s\S]*?transform:none/.test(css), 'F handle must be horizontal and 48px by default, never below 44px on narrow screens.');
expect(css.includes('--v2-e-pull:var(--v2-card-handle)') && !css.includes('.v2-app.has-e-deck .v2-deck{width:'), 'E must expose the full 48px/44px handle beside F; F must never widen over E.');
expect(/\.v2-deck__card\{[\s\S]*?pointer-events:none;/.test(css) && /\.v2-deck__card strong\{[\s\S]*?pointer-events:auto;/.test(css) && /\.v2-e-card\{[\s\S]*?pointer-events:none;/.test(css) && /\.v2-e-card strong\{[\s\S]*?pointer-events:auto;/.test(css), 'Only visible F/E handles may own pointer input; full card bodies must never block another visible handle.');
expect(css.includes('--v2-e-max-height:calc(66.666% - 24px)') && /\.v2-e-deck\{[\s\S]*?top:auto;[\s\S]*?bottom:0;[\s\S]*?height:var\(--v2-e-max-height\)/.test(css) && !css.includes('--v2-e-top-gap'), 'E must live from the bottom of F and never grow above the lower two thirds of F.');
expect(css.includes('--v2-e-top-gap:72px') && /\.v2-e-deck\{[\s\S]*?top:calc\(var\(--v2-deck-top\) \+ var\(--v2-e-top-gap\)\);[\s\S]*?bottom:0/.test(css) && /\.v2-e-card\{[\s\S]*?bottom:0;/.test(css) && !/\.v2-e-card\{[\s\S]*?height:50%/.test(css), 'E must start below F and continue to the bottom instead of rendering as a hanging half-height fragment.');
expect(/\.v2-e-card strong\{[\s\S]*?min-width:var\(--v2-card-handle-min\);[\s\S]*?height:var\(--v2-card-handle\);[\s\S]*?transform:none/.test(css), 'E handle must stay directly reachable with a 44px minimum target and horizontal label.');
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
expect(ui.includes('let suppressNextClick = false;') && ui.includes("surface.addEventListener('click', click, true)") && ui.includes('event.preventDefault();') && ui.includes('event.stopPropagation();'), 'Shared Z swipe must suppress the accidental interactive click generated after a horizontal drag.');
expect(ui.includes('const tabStep = 48;') && ui.includes('const tabOrder = count - 1 - visualDepth;') && ui.includes('const depthY = tabOrder * tabStep;'), 'F and E must render as exposed 48px hierarchy tabs instead of hidden depth-only stacks.');
expect(ui.includes('.slice(0, 7)') && ui.includes('data-v2-f-index="${index}"') && !ui.includes('data-v2-f-level'), 'F cards must be peer folders with real names, not visual F1/F2/F3 levels.');
expect(ui.includes("const leftOrDownLeft = dx < -5 && dy >= -8;") && ui.includes('current.dx <= -threshold') && ui.includes('const nextIndex = (fActiveIndex + 1) % fCards.length'), 'F must move only left/down-left and must never detach to the right.');
expect(ui.includes('directPickThreshold = 14') && ui.includes('directDistance >= directPickThreshold') && ui.includes('current.dy >= directPickThreshold'), 'F/E direct selection must require a physical pull and must not turn folder taps into click navigation.');
expect(ui.includes("const downOnly = dy > 5") && ui.includes("gesture.axis = 'e'") && ui.includes("--v2-e-drag-y") && !ui.slice(ui.indexOf('export function initV2WorkspaceInteraction'), ui.indexOf('export function initV2StickerSwipe')).includes('--v2-e-drag-x'), 'E must be owned by the same workspace gesture owner and move only downward.');
expect(ui.includes("stage.addEventListener('pointerdown', down)") && ui.includes("stage.addEventListener('pointermove', move") && !ui.slice(ui.indexOf('export function initV2WorkspaceInteraction'), ui.indexOf('export function initV2StickerSwipe')).includes('initV2DeckSwipe(') && !ui.slice(ui.indexOf('export function initV2WorkspaceInteraction'), ui.indexOf('export function initV2StickerSwipe')).includes('initV2Swipe('), 'Workspace F/E/Z must have one stage pointer owner with no delegated competing swipe owners.');
expect(!ui.includes('initV2DeckSwipe') && !facade.includes('initV2DeckSwipe'), 'Legacy deck swipe owner must not exist or be exported; workspace interaction is the only FEZ owner.');
expect(ui.includes('data-v2-front') && css.includes('.v2-fe-deck{') && css.includes('transform:none;') && !/\.v2-app\.is-deck-open[^\{]*\.v2-z[^\{]*\{[^}]*transform:/s.test(css), 'FE must stay pinned to the left while only the shared H+Z front layer moves; Z may not slide independently over cards.');
expect(ui.includes('ownsHorizontalGesture') && ui.includes("overflowX === 'auto'") && ui.includes("touchAction.includes('pan-x')"), 'Closed Z must yield to nested horizontal rails instead of stealing their gestures.');
expect(ui.includes("current.openAtStart && distance < 7") && ui.includes('setOpen(false);'), 'When FE is open, a tap on Z must open the page without activating controls underneath.');
expect(core.includes('initV2WorkspaceInteraction(shell') && core.includes('eActiveId: childActive') && core.includes('onSecondarySelect: (id) => selectSecondary(id)'), 'Workspace must route F/E/Z interaction through the single Shared workspace owner.');
expect(css.includes('box-shadow:-9px 8px 14px -11px rgba(0,0,0,.34)') && css.includes('.v2-z .entity-card{transform:translateY(-2px)') && css.includes('.v2-rail-card{') && css.includes('transform:translateY(-2px)'), 'Z stickers must lift at the edges while large cards float above the Z surface.');
expect(css.includes('touch-action:pan-y'), 'Shared V2 surfaces must allow vertical scrolling without fighting horizontal swipe.');
expect(account.includes("const next = id === 'history' ? 'history' : 'representatives';") && account.includes('initV2WorkspaceInteraction(root'), 'Changing the active end-user F folder must route through the Shared workspace owner and immediately change Z to that folder face.');
expect(accountMobileCss.includes('background:var(--v2-base)'), 'Public booking shell safe area must continue the H base.');
expect(core.includes("setThemeColor('#2F3338')") && core.includes("setThemeColor('#F5F5F3')"), 'Public booking must tint browser chrome to H and restore the workspace theme afterwards.');
expect(booking.includes('v2LegalCards(') && booking.includes('v2Sticker({'), 'Legal checkpoint must use the shared sticker system.');
expect(!booking.includes('data-booking-workplaces-back') && !booking.includes('data-booking-confirm-back'), 'V2 booking flow must not restore legacy back buttons.');

expect(core.includes("className: 'v2-app--workspace'") && core.includes('v2EList(childItems') && core.includes('eDeck,'), 'Professional workspace must render second-level navigation as E inside the shared FE shell.');
expect(core.includes('v2Shell({') && account.includes('v2Shell({'), 'Professional and end-user contours must both render through the Shared H/F/E/Z shell owner.');
expect(core.includes('v2Header({') && account.includes('v2Header({'), 'Professional and end-user contours must both render Header A/B/C/D through the Shared Header owner.');
expect(ui.includes('export function v2Shell') && ui.includes('data-v2-app') && ui.includes('data-v2-fe') && ui.includes('data-v2-z'), 'Shared shell owner must own H, FE and Z structural layers.');
expect(ui.includes('export function v2Header') && ui.includes("headerControl(a, 'a')") && ui.includes("headerControl(c, 'c')") && ui.includes("headerControl(d, 'd')") && ui.includes('v2-header__title'), 'Shared Header owner must own A, B, C and D.');
expect(css.includes('--v2-base:var(--surface-dark)') && css.includes('.v2-header{') && css.includes('.v2-app__stage{') && css.includes('.v2-fe-deck{') && css.includes('.v2-z{'), 'H/F/E/Z geometry and Header geometry must stay in the shared V2 stylesheet.');
expect(!account.includes('appHeader(') && !account.includes('appShell('), 'End-user account must not create a parallel local H/Header/Z shell.');
expect(!core.includes('appHeader(') && !core.includes('appShell('), 'Professional workspace must not create a parallel local H/Header/Z shell.');

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
expect(css.includes('.v2-e-deck{') && ui.includes('class="v2-fe-deck" data-v2-fe') && ui.includes('${eDeck}${deck}') && !css.includes('.v2-deck--secondary') && !css.includes('--v2-z-double-open-x:'), 'E must remain in the single FE hierarchy owner instead of becoming a second independent F strip.');
expect(css.includes('.v2-app.is-deck-open > .v2-app__stage > .v2-front') && ui.includes('const isTopmost = () =>') && ui.includes('return layers.length === 0;') && ui.includes("event.target.closest?.('[data-v2-layer], [data-v2-z-layer]')") && ui.includes('revealDeck: false'), 'Deck-open state must move only the shared H+Z front while Z2 keeps independent topmost gesture ownership and never reveals FE.');
expect(finance.includes('export function financeNavigationItems()') && finance.includes('export function renderFinanceSection('), 'Finance E navigation must route to the existing Finance screens.');
for (const label of ['Касса', 'ДДС', 'Доход / Расход', 'Статьи', 'Прочие операции', 'Z-отчёт']) expect(finance.includes(`label: '${label}'`), `Finance E is missing ${label}.`);
expect(journal.includes('export function journalNavigationItems()') && journal.includes('export function renderJournalView(') && journal.includes('externalNavigation'), 'Journal E must route the existing Day/Month/List views without duplicating them.');
expect(settings.includes('export function settingsNavigationItems()') && settings.includes('export async function renderSettingsSection(') && settings.includes("key !== 'profile'"), 'Settings E must route existing settings children while Profile stays a root F folder.');
expect(onlineBookingSettings.includes('workspaceHeaderContext({') && onlineBookingSettings.includes("back: { data: 'data-online-booking-back'") && onlineBookingSettings.includes('data-v2-primary-action'), 'Online booking settings must feed Header/Back/Save through Shared workspace sources instead of drawing a second shell.');
expect(!/\b(?:appShell|appHeader)\s*\(/.test(onlineBookingSettings) && !onlineBookingSettings.includes('app-content--book-shell'), 'Online booking settings must not recreate a full-screen shell inside Z.');
expect(!/(?:min-|max-)?height\s*:\s*(?:var\(--visual-vh\s*,\s*)?100dvh|position\s*:\s*fixed|touch-action\s*:/.test(onlineBookingSettingsCss), 'Online booking settings CSS must stay content-only inside Shared Z.');
expect(core.includes("[data-workspace-back-source], .app-header__slot--back button"), 'Workspace Header owner must proxy canonical back sources without requiring a nested appHeader.');
expect(!journalList.includes('getBoundingPersonRect') && journalList.includes('getBoundingClientRect()'), 'Journal List scroll must use the real DOM geometry API.');
expect(firstRun.includes("return 'people';") && firstRun.includes("return 'finance';") && firstRun.includes("if (SETTINGS_STEPS.has(step.key)) return 'settings';") && firstRun.includes('data-v2-secondary-item'), 'DEMO navigation must follow the migrated V2 workspace entry points without changing its business progression.');
expect(firstRun.includes("if (SETTINGS_STEPS.has(step.key)) {\n      await this.renderWorkspaceStep(step);") && !firstRun.includes('async renderSettingsStep('), 'DEMO Settings steps must reuse the real Shared V2 workspace instead of rendering a parallel focused shell.');
for (const marker of ['data-v2-secondary-item="online-booking"', 'data-v2-secondary-item="communications"', 'data-v2-secondary-item="integrations"', 'data-v2-secondary-item="tags"', 'data-v2-secondary-item="documents"']) {
  expect(firstRun.includes(marker), `DEMO Settings routing must use the real V2 E folder: ${marker}.`);
}
expect(firstRun.includes("ONLINE_BOOKING_STEPS.has(step.key) && onlineBookingFolder"), 'DEMO online-booking substeps must navigate into the real E folder before treating the substep as entered.');
expect(!firstRun.includes("step.key === 'procedures' || step.key === 'products' || SETTINGS_STEPS.has(step.key)"), 'DEMO Settings must not bypass active workspace-section recovery inside syncCurrent().');
expect(firstRun.includes("const requiredSection = this.workspaceSection(step);") && firstRun.includes("if (activeSection !== requiredSection)"), 'DEMO Settings must retain the normal workspace recovery path when the user leaves the required F section.');
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
expect(buttonCss.includes('border:1px solid var(--white)') && buttonCss.includes('.ui-button--secondary,.ui-button--outline{border-color:var(--text);background:var(--white);color:var(--text)}') && buttonCss.includes('.ui-button:disabled{'), 'Shared Button owner must keep primary black/white, secondary white/black, rounded, with a separate disabled state.');
expect(buttonCss.includes('.v2-app .ui-button{border-radius:14px}') && !buttonCss.includes('.v2-app .ui-button,.v2-app .icon-button'), 'V2 must not flatten the main Shared button geometry.');
expect(segmentUi.includes('filter(Boolean).map') && segmentUi.includes('--segment-count:') && !segmentUi.includes('.slice(0, 3)'), 'Shared segmented-control owner must support 2, 3, and larger option sets without parallel variants.');
expect(segmentCss.includes('border:1px solid var(--text)') && segmentCss.includes('border-radius:14px') && segmentCss.includes('background:var(--white)') && segmentCss.includes('button.is-active{') && segmentCss.includes('background:var(--text)') && segmentCss.includes('color:var(--white)') && !/(^|})\.segment-control\s*\{/.test(style), 'Segmented control styling must live only in its Shared owner with black active and white inactive states.');
expect(infoUi.includes('export function infoUI') && infoUi.includes('export function initInfoUI') && facade.includes('infoUI') && facade.includes('initInfoUI'), 'Shared Info UI owner must be exposed through ui/ui.js.');
expect(infoCss.includes('width:24px') && infoCss.includes('border:1px solid #111') && infoCss.includes('border-radius:0') && infoCss.includes('.ui-info--inverse'), 'Info UI must use the approved small square i control and inverse contrast on dark surfaces.');
expect(inputsCss.includes('.field input,.field select,.field textarea') && !inputsCss.includes('border-radius:12px') && listCss.includes('border-radius:0') && listEntryCss.includes('border-radius:0'), 'Shared working inputs, selects and list rows must remain straight.');
expect(!listCss.includes('border-radius:0 17px') && listCss.includes('.ui-list__item.is-first:not(.is-last){border-radius:0}'), 'Shared List must keep the approved fully straight row geometry without the legacy rounded first row.');
expect(selectorsUi.includes("import { modal, mountModal } from '../modals/index.js';") && selectorsUi.includes("variant: 'quick'") && !selectorsUi.includes('document.body.appendChild(surface)'), 'Shared Select must manifest through the canonical bottom Modal owner instead of a fixed body overlay.');
expect(!/\.ui-selector\s*\{[^}]*position\s*:\s*fixed/s.test(selectorsCss), 'Shared Select must not own a parallel fixed overlay.');
expect(miniCardUi.includes('export function miniCardRail') && miniCardCss.includes('--mini-card-width:238px') && miniCardCss.includes('--mini-card-height:144px') && miniCardCss.includes('border:2px solid #111') && miniCardCss.includes('border-radius:16px') && miniCardCss.includes('padding:16px'), 'Shared Mini Card must keep one fixed 238x144 geometry with 2px black frame, 16px radius and 16px inner padding.');
expect(miniCardCss.includes('word-break:normal') && miniCardCss.includes('overflow-wrap:normal') && miniCardCss.includes('hyphens:none'), 'Shared Mini Card text must wrap only between whole words.');
expect(miniCardUi.includes("surface = 'default'") && miniCardUi.includes("surface === 'photo'") && miniCardUi.includes("actionLabel = ''") && miniCardCss.includes('.mini-card--surface-photo') && miniCardCss.includes('.mini-card__context-action'), 'Shared Mini Card must own contextual surfaces: white by default and photo/gradient with a framed contextual action when explicitly requested.');
expect(miniCardUi.includes('export function miniCardStack') && facade.includes('miniCardStack') && miniCardCss.includes('.mini-card-stack'), 'Shared Mini Card owner must also provide the canonical vertical stack composition.');
expect(entityCardCss.includes('--entity-card-depth:#2C2A28') && entityCardCss.includes('--entity-card-mid:#817A73') && entityCardCss.includes('--entity-card-light:#D7D1CA') && entityCardCss.includes('radial-gradient(circle at 78% 18%') && !entityCardCss.includes('--entity-card-neutral') && !entityCardCss.includes('var(--v2-disabled') && !entityCardCss.includes('var(--button-secondary)'), 'Photo-less Entity Card must own a warm Shared gradient and must never derive its surface from disabled/system gray.');
expect(entityCardCss.includes('.entity-card.has-image .entity-card__background') && entityCardCss.includes('var(--entity-card-image)'), 'Entity Card with photo must keep the photo as the base with only a soft readability veil.');
expect(entityCardUi.includes('export function entityCardStack') && facade.includes('entityCardStack') && entityCardCss.includes('.entity-card-stack{display:grid'), 'Shared Entity Card owner must provide the canonical vertical card stack.');
expect(inputs.includes('data-photo-crop-x-value') && inputs.includes('data-photo-crop-y-value') && inputs.includes('setOriginal(src)') && !inputs.includes('croppedSquare('), 'Shared photo owner must preserve the original image and store crop position metadata instead of replacing the original with a cropped blob.');
expect(headerUi.includes('export function workspaceHeaderContext') && facade.includes('workspaceHeaderContext'), 'Canonical Header owner must own workspace context metadata.');
expect(ui.includes("kind === 'logo'") && css.includes('.v2-header__slot--a .v2-header__control') && css.includes('width:48px') && css.includes('height:48px') && css.includes('border:2px solid #fff') && css.includes('background:var(--v2-base)') && css.includes('.v2-header__slot--a .v2-header__avatar--initials{background:transparent;color:#fff}'), 'Shared Header A must keep one 48x48 H circle with a 2px white outline while section data alone changes its content.');
expect(css.includes('.v2-header__slot--d .v2-header__control--chat') && css.includes('background:transparent;color:#fff') && css.includes('.v2-header__icon--chat svg') && css.includes('fill:currentColor;stroke:none'), 'Shared Header D chat must be the white chat mark without a circular button surface.');
expect(css.includes('.v2-header__slot--c .v2-header__control{') && css.includes('border:1px solid #fff') && css.includes('background:#111;color:#fff') && css.includes('.v2-header__slot--c .v2-header__control--danger'), 'Shared Header C must default to black with white outline/text and change colour only through an explicit special variant.');
expect(ui.includes("c && !c.hidden ? 'has-c' : ''") && ui.includes("d && !d.hidden ? 'has-d' : ''") && css.includes('.v2-header:not(.has-d).has-c .v2-header__slot--c{grid-column:3/5;justify-items:end}'), 'Shared Header must move C into the chat area when D is absent and keep C left of D when chat is present.');
expect(headerUi.includes("const actionDisabled = a?.disabled ? ' disabled' : ''") && core.includes('disabled: Boolean(aSource.disabled)'), 'Shared Header context must support a visible but inactive A control without feature-local handling.');
expect(!ui.includes('v2WorkspaceContext'), 'Shared V2 must not duplicate the canonical Header context owner.');
expect(ui.includes('export function v2ZLayer') && ui.includes('export function mountV2ZLayer'), 'Shared V2 must own stacked Z layers.');
expect(ui.includes('export function v2Layer') && ui.includes('export function mountV2Layer'), 'Shared V2 may keep modal geometry primitives internally for ui/modals.');
expect(!facade.includes('v2Layer') && !facade.includes('mountV2Layer'), 'ui/ui.js must not expose internal V2 modal primitives alongside the canonical modal owner.');
expect(core.includes('activeWorkspaceSurface(surface)') && core.includes("context?.dataset.workspaceHideD === 'true'") && core.includes("[data-workspace-context-action]"), 'Workspace Header must follow the top Z layer and consume the canonical Header context owner.');

expect(modals.includes("import { mountV2Layer, v2Layer } from '../v2/index.js';")
  && modals.includes('v2Layer(content')
  && modals.includes('mountV2Layer(html, { root })')
  && modals.includes("variant = 'technical'")
  && !modals.includes('<div class="modal-backdrop"'),
  'ui/modals must remain the sole public modal owner and route work modals into active Z while reserving technical overlays for system cases.');
expect(timeUi.includes("variant:'top'"), 'Time Picker must use the Shared TOP modal instead of a global/system overlay.');
expect(ui.includes("const allowed = new Set(['top', 'standard', 'bottom', 'technical'])") && ui.includes("const technical = kind === 'technical'") && ui.includes('activeV2ModalSurface(root)'), 'Internal V2 modal geometry must expose exactly the approved top/standard/bottom/technical model.');
expect(ui.includes('function initV2LayerDismissGesture') && ui.includes("kind === 'top' ? Math.min(0, raw) : Math.max(0, raw)") && ui.includes('stopPointerPropagation') && ui.includes("resolved === 'technical'"), 'Shared Modal must own origin-directed dismissal, isolate pointer gestures from lower Z/F/E, and reserve X for technical overlays only.');
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
expect(account.includes('initV2WorkspaceInteraction(root'), 'End-user F/E/Z interaction must use the single Shared workspace owner.');
expect(!account.includes('initV2DeckSwipe(root') && !account.includes('function bindRootSwipe') && !account.includes('function bindDeck('), 'End-user account must not re-own F/Z gesture binding beside the Shared workspace owner.');
expect(core.includes('initV2WorkspaceInteraction(shell') && !core.includes('initV2DeckSwipe(rootDeckNode') && !core.includes('initV2Swipe(z'), 'Professional workspace must consume the same Shared workspace interaction owner as the end-user account.');
expect(account.includes("className: 'v2-app--chat'"), 'End-user Chat must share V2 H + Z geometry.');
expect(account.includes("attachmentTrigger: 'external'"), 'Chat attachment action must live in Header D.');
expect(!account.includes('accountBottomNavigation') && !account.includes('bindBottomNavigation'), 'End-user V2 must not contain bottom navigation.');
expect(!account.includes('<style>') && !booking.includes('<style>'), 'Feature code must not create local V2 style owners.');

if (failures.length) {
  failures.forEach((message) => console.error(`ui v2 architecture: ${message}`));
  process.exit(1);
}

console.log('ui v2 architecture check: OK');
