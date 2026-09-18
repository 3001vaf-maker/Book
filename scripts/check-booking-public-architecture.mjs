import fs from 'node:fs';

const booking = fs.readFileSync('online-booking/booking.js', 'utf8');
const accountShell = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const consentSettings = fs.readFileSync('online-booking/consent-settings.js', 'utf8');
const settings = fs.readFileSync('settings/online-booking/online-booking.js', 'utf8');
const serverSync = fs.readFileSync('online-booking/server-sync.js', 'utf8');
const bookingUi = fs.readFileSync('ui/booking/index.js', 'utf8');
const shellUi = fs.readFileSync('ui/shell/index.js', 'utf8');
const shellCss = fs.readFileSync('ui/shell/shell.css', 'utf8');
const styleCss = fs.readFileSync('css/style.css', 'utf8');
const publicMobileCss = fs.readFileSync('ui/shell/public-mobile.css', 'utf8');
const navigationUi = fs.readFileSync('ui/navigation/navigation.js', 'utf8');
const navigationCss = fs.readFileSync('ui/navigation/navigation.css', 'utf8');
const referenceUi = fs.readFileSync('ui/reference/reference.js', 'utf8');
const referenceHtml = fs.readFileSync('ui/reference/index.html', 'utf8');
const referenceCss = fs.readFileSync('ui/reference/reference.css', 'utf8');
const rootHtml = fs.readFileSync('index.html', 'utf8');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(booking.includes("from '../core/booking-settings/index.js'"), 'Public booking must consume canonical booking settings.');
expect(booking.includes('appShell({'), 'Booking workflow must use the shared App Shell.');
expect(booking.includes('appHeader({ title, back, action })'), 'Booking workflow must use the shared stable A/title/B/C header.');
expect(booking.includes('bookingThemeStyle(state.settings)'), 'Booking workflow must keep the master-selected booking theme.');
expect(!booking.includes('bookingScreen('), 'Booking workflow must not return to the legacy separate booking screen shell.');
expect(booking.includes('bookingChoiceCards('), 'Public booking choices must use shared booking choice UI.');
expect(booking.includes('bookingTimeGroups('), 'Public booking time must use shared grouped time UI.');
expect(booking.includes('initCalendar('), 'Public booking date must use the shared Book calendar.');
expect(!booking.includes("type: 'date'"), 'Public booking must not use native technical date controls.');

expect(booking.includes('renderRegistrationAgreements') && booking.includes('renderAccountEntry') && booking.includes('renderAccountDetails') && booking.includes('renderPassword'), 'Registration must own agreements, account lookup, details and password.');
expect(booking.includes("subtitle: 'Согласия относятся к регистрации и аккаунту клиента'"), 'Consent UI must be explicitly registration/account scoped.');
expect(booking.includes('if (prepared.exists) renderPassword(root, state);') && booking.includes('else renderAccountDetails(root, state);'), 'Registration must branch between an existing account and a new public.');
expect(booking.includes('if (payload.publicCardExisted)') && booking.includes("state.publicTab = 'profile'"), 'Known publics must land on the personal page after registration.');
expect(booking.includes('else {\n          nextBookingStep(root, state);'), 'New publics without an existing card must continue into booking after registration.');

expect(booking.includes('renderWorkplaces') && booking.includes('renderProcedures') && booking.includes('renderDates') && booking.includes('renderTimes') && booking.includes('renderConfirmation'), 'Booking itself must preserve workplace -> procedures -> date -> time -> confirmation.');
expect(booking.includes("root.querySelector('[data-booking-workplaces-back]')?.addEventListener('click', () => backFromFirstBookingStep(root, state));"), 'Back from the first booking step must leave booking, not return to registration.');
expect(booking.includes("if (state.lockedWorkplaceKey) backFromFirstBookingStep(root, state);"), 'Back from procedures on a locked-workplace link must leave booking, not return to registration.');
expect(booking.includes("root.querySelector('[data-booking-dates-back]')?.addEventListener('click', () => renderProcedures(root, state));"), 'Date back must return to procedures.');
expect(booking.includes("root.querySelector('[data-booking-times-back]')?.addEventListener('click', () => renderDates(root, state));"), 'Time back must return to date.');
expect(booking.includes("root.querySelector('[data-booking-confirm-back]')?.addEventListener('click'"), 'Confirmation must have a back control.');
expect(booking.includes('function backFromFirstBookingStep') && booking.includes('renderAccountHome(root, state)'), 'The booking back boundary must return to the personal page.');

expect(booking.includes('renderPublicAccount'), 'Authenticated public account must use the unified public shell.');
expect(!booking.includes('step: 15'), 'Public booking must not hardcode a 15 minute slot step.');
expect(settings.includes("from '../../core/booking-settings/index.js'"), 'Online booking settings must use canonical booking settings owner.');
expect(settings.includes('appShell({') && settings.includes('appHeader({'), 'Online booking settings must use the shared Book shell instead of a local page header.');
expect(settings.includes("title: 'Онлайн-запись'") && settings.includes("data: 'data-online-booking-sections'"), 'Online booking parent screen must expose settings from C while V remains link-focused.');
expect(settings.includes("title: 'Приветствие'") && settings.includes("title: 'Внешний вид'") && settings.includes("title: 'Время записи'"), 'Online booking settings must be three separate screens.');
expect(settings.includes("{ title: 'Приветствие', data: 'data-online-booking-open=\"welcome\"' }") && settings.includes("{ title: 'Внешний вид', data: 'data-online-booking-open=\"appearance\"' }") && settings.includes("{ title: 'Время записи', data: 'data-online-booking-open=\"time\"' }"), 'Online booking C navigation must be a folder list, not a button group.');
expect(settings.includes("label: 'Сохранить'") && settings.includes('setSaveVisible(root, false)'), 'B Save must exist only as a change-dependent action.');
expect(settings.includes("label: 'Отменить'") && settings.includes("label: 'Сбросить'") && settings.includes("variant: 'outline'"), 'Appearance C actions must use the compact outlined action pattern.');
expect(settings.includes('twoColumnLayout(') && settings.includes("ariaLabel: 'Цвета фона'") && settings.includes("ariaLabel: 'Цвета интерфейса'"), 'Appearance colors must use the shared two-column layout.');
expect(settings.includes('BOOKING_SLOT_STEPS.map') && settings.includes("value === 60 ? '1 час'"), 'Time screen must use the canonical 5/10/15/30/60 slot select.');
expect(serverSync.includes("apiRequest('/business-state')"), 'Open Book must refresh from canonical server business state.');
expect(shellUi.includes('appHeader'), 'Shared UI must own stable A/title/B/C header.');
expect(shellUi.includes("variant: 'secondary'"), 'Shared header secondary controls must use the canonical light button role.');
expect(shellUi.includes('publicBottomNavigation'), 'Shared UI must own public bottom navigation.');
expect(shellUi.includes('messageComposer'), 'Shared UI must own messenger composer.');
expect(shellUi.includes('message-composer--plain') && shellUi.includes('message-composer--with-attachments'), 'Shared messenger composer must own both master/plain and attachment layouts.');
expect(shellUi.includes('readOnlyReceipt'), 'Shared UI must own read-only receipt sheet.');
expect(shellUi.includes('app-view-shell--has-media'), 'Shared shell must know whether S/media is present.');
expect(shellCss.includes('--shell-icon-slot'), 'Shared shell CSS must own stable header control sizing.');
expect(shellCss.includes('grid-template-columns:auto minmax(0,1fr) auto auto'), 'Shared A/J/B/C header must redistribute unused space instead of reserving empty fixed columns.');
expect(shellCss.includes('.app-view-shell--chat') && shellCss.includes('.message-composer{position:fixed'), 'Shared shell CSS must keep chat composer fixed while the thread scrolls.');
expect(styleCss.includes('--app-max-width:390px'), 'Book must use one shared 390px application width for master and public surfaces.');
expect(!publicMobileCss.includes('--app-max-width:'), 'Public shell must inherit the shared Book application width instead of redefining it.');
expect(!publicMobileCss.includes('max-width:none'), 'Public application must never disable its phone-width limit.');
expect(!accountShell.includes("document.createElement('style')") && !accountShell.includes('<style>'), 'Public features must not own local CSS.');
expect(accountShell.includes("messageComposer({ attachments: true, rich: true })"), 'Public chat must use the shared rich composer with media attachment control.');
expect(accountShell.includes("label: 'Повторить запись'"), 'Public history must use the agreed repeat-booking action.');
expect(accountShell.includes("label: 'Согласия'"), 'Public account and chat settings must expose consent controls.');
expect(consentSettings.includes('revokeBookingConsent'), 'Public consent settings must use the canonical server-backed revoke flow.');
expect(bookingUi.includes('bookingChoiceCards'), 'Shared booking UI must continue to own booking choice controls.');

expect(navigationUi.includes("{ id: 'main', label: 'Главная'") && navigationUi.includes("{ id: 'timetable', label: 'График'") && navigationUi.includes("{ id: 'journal', label: 'Журнал'") && navigationUi.includes("{ id: 'chat', label: 'Чат'") && navigationUi.includes("{ id: 'settings', label: 'Настройки'"), 'Book bottom navigation must keep the canonical five destinations.');
expect(navigationUi.includes('class="nav-label"'), 'Bottom navigation labels must use the canonical label class.');
expect(navigationCss.includes('grid-template-columns:repeat(5,minmax(0,1fr))'), 'Book bottom navigation must divide the available width into five equal slots.');
expect(navigationCss.includes('font-size:10px') && navigationCss.includes('white-space:nowrap'), 'All five bottom navigation labels must share a compact single-line label rule.');
expect(rootHtml.includes('ui/navigation/navigation.css'), 'Book must load the canonical navigation stylesheet.');

expect(referenceHtml.includes('reference.css') && referenceHtml.includes('reference-controls'), 'The Book UI reference must keep lab controls outside the 390px application shell.');
expect(referenceCss.includes('.ui-reference-toolbar') && referenceCss.includes('position:fixed'), 'Reference-only controls must remain outside the Book phone surface.');
expect(referenceUi.includes("bottomNavigation('settings')"), 'The Book UI reference must render the same five-slot bottom navigation used by the master application.');
expect(referenceUi.includes("['profile', 'Карточка — без S']") && referenceUi.includes("['profile-media', 'Карточка — с S']") && referenceUi.includes("['chat', 'Чат']") && referenceUi.includes("['form', 'Форма']"), 'Reference must expose multiple UI screen forms and S/no-S states.');
expect(referenceUi.includes("'Сохранить', 'Далее', 'Готово', 'Добавить', 'Создать'"), 'Reference must expose canonical B label fit checks.');
expect(referenceUi.includes('modal(') && referenceUi.includes('mountModal('), 'Reference must exercise the real shared modal component.');
expect(referenceUi.includes("button('Личные данные'") && referenceUi.includes("button('Согласия'") && referenceUi.includes("button('Изменить пароль'") && referenceUi.includes("button('Выход'"), 'Reference profile settings must include all approved actions.');
const personalIndex = referenceUi.indexOf("button('Личные данные'");
const consentIndex = referenceUi.indexOf("button('Согласия'");
const passwordIndex = referenceUi.indexOf("button('Изменить пароль'");
const logoutIndex = referenceUi.indexOf("button('Выход'");
expect(personalIndex >= 0 && personalIndex < consentIndex && consentIndex < passwordIndex && passwordIndex < logoutIndex, 'Reference profile settings must keep the approved action order.');
expect(referenceUi.includes("button('Личные данные', { variant: 'outline'") && referenceUi.includes("button('Согласия', { variant: 'outline'") && referenceUi.includes("button('Изменить пароль', {") && referenceUi.includes("button('Выход', { variant: 'danger'"), 'Reference profile settings must keep the approved button variants.');
expect(!referenceUi.includes('apiRequest(') && !referenceUi.includes('fetch(') && !referenceUi.includes('localStorage') && !referenceUi.includes('sessionStorage') && !referenceUi.includes("from '../../core/") && !referenceUi.includes("from '../core/"), 'Reference must remain free of API, persistence and business-layer dependencies.');

if (failures.length) {
  failures.forEach((message) => console.error(`booking public architecture: ${message}`));
  process.exit(1);
}
console.log('booking public architecture check: OK');
