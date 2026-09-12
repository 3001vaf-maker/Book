# Book — реестр общих UI-функций

Этот файл — актуальный реестр публичного Shared UI Book. Источник истины по экспортам — `ui/ui.js`; при изменении его публичного контракта этот реестр обновляется в том же PR.

## Правила

- одна UI-функция — одна реализация;
- `ui/ui.js` — публичный фасад, а не место для дублирования реализаций;
- перед созданием нового UI сначала проверяется этот реестр;
- функциональные экраны не копируют общий компонент и не создают локальный CSS-обход;
- бизнес-правила и persistence не принадлежат UI.

## Публичный UI-контракт

| Категория | Путь владельца | Публичные функции |
|---|---|---|
| Accordion | `ui/accordion/` | `accordion`, `initAccordions` |
| Navigation | `ui/navigation/` | `bottomNavigation` |
| View navigation | `ui/view-navigation/` | `viewNavigation`, `initViewNavigation` |
| Calendar / Date | `ui/calendar/` | `calendar`, `initCalendar`, `monthDayPicker`, `initMonthDayPickers`, `dateNavigator`, `initDateNavigator` |
| Selection | `ui/selection/` | `initMultiSelect` |
| Entity / Folder cards | `ui/cards/` | `entityCard`, `folderCard`, `folderList` |
| Lists | `ui/lists/` | `list`, `listEntry`, `listEntries` |
| Selectors | `ui/selectors/` | `select`, `searchableSelect` |
| Links | `ui/links/` | `links`, `initLinks`, `collectLinks` |
| Tags | `ui/tags/` | `tags`, `tagManagerList`, `initTags`, `collectTags` |
| Cost | `ui/cost/` | `costField`, `initCostFields`, `collectCost`, `costListParts`, `costCardMeta` |
| Duration | `ui/duration/` | `durationPicker`, `durationText`, `initDurationPickers` |
| Time | `ui/time/` | `timePicker`, `timeSlots`, `initTimePickers`, `journalDayTimeline`, `initJournalDayTimeline` |
| Layout | `ui/layout/` | `twoColumnLayout` |
| Workplaces | `ui/workplaces/` | `workplaceSelector`, `initWorkplaceSelectors`, `collectWorkplaceSelections`, `workplaceAddButton`, `workplaceContent`, `openWorkplaceControl`, `workplaceCountText`, `ALL_WORKPLACES_ID`, `getWorkplaceContext`, `setWorkplaceContext`, `dayWorkplaceContent`, `openDayWorkplaceControl`, `openDayWorkplaceTime` |
| Header | `ui/header/` | `pageHeader`, `headerControl`, `headerToggle`, `headerControlGroup`, `openHeaderControl` |
| Modals | `ui/modals/` | `modal`, `mountModal`, `openNotice` |
| Buttons | `ui/buttons/` | `button`, `iconButton`, `copyIconButton`, `copyTextToClipboard`, `setCopyButtonCopied`, `sheetIconButton`, `iconButtonGroup` |
| Inputs | `ui/inputs/` | `field`, `phoneField`, `textareaField`, `photoField`, `initPhotoField` |
| States | `ui/states/` | `emptyState`, `stateView`, `initStateView` |
| Colors | `ui/colors/` | `colorPicker`, `initColorPickers` |
| Utils | `ui/utils/` | `escapeHtml`, `shortDate`, `shortTime`, `shortDateTime`, `shortDateTimeParts` |
| Page composition | `ui/page/` | `page`, `details`, `agreementBlock`, `actionBlock` |
| Repeated fields | `ui/repeated-fields/` | `repeatedField`, `initRepeatedFields`, `collectRepeatedField`, `collectRepeatedEntries` |
| UEI | `ui/uei/` | `uei`, `initUEI` |
| Payment | `ui/payment/` | `paymentForm`, `initPaymentForm`, `paymentMethods`, `initPaymentMethods`, `paymentReceipt` |
| Public booking | `ui/booking/` | `bookingAccountHeader`, `bookingAction`, `bookingActions`, `bookingAgreementCards`, `bookingChoiceCards`, `bookingDocument`, `bookingHeading`, `bookingHistoryCards`, `bookingPersonalDataButton`, `bookingScreen`, `bookingThemePreview`, `bookingThemeStyle`, `bookingTimeGroups` |

## Ключевые ownership-границы

### Header / Workplace

`headerControl` и `openHeaderControl` — универсальная оболочка заголовка. Они не знают бизнес-смысл содержимого.

`workplaceContent` — нейтральное представление рабочего пространства.

`openWorkplaceControl` — текущее Workplace-проявление Графика на общих `Header Control + List`. Оно не является универсальным контроллером Журнала и не владеет правилами рабочего времени.

Журнал имеет собственную manifestation `journal/workplace-control.js`, которая использует Shared UI, но не создаёт второй Shared UI-компонент.

`openDayWorkplaceControl` / `openDayWorkplaceTime` относятся к сценарию рабочего дня; бизнес-валидация остаётся в Day/Time Core.

### Time

`timePicker` выбирает фактическое время суток. `durationPicker` выбирает длительность; эти понятия не взаимозаменяются.

`journalDayTimeline` только отображает готовое состояние и отдаёт события. Availability/occupancy рассчитывает Core Time.

### Finance / Payment

Payment UI собирает ввод и показывает состояние. Финансовые расчёты и факты движения денег принадлежат `core/finance/`.

### Booking

`ui/booking/` — общая визуальная система публичной онлайн-записи. Данные Account/Record/Availability не принадлежат этим UI-функциям.

## Синхронизация

При добавлении, переименовании или удалении публичного экспорта в `ui/ui.js` в этом же изменении обновляется соответствующая строка таблицы. Исторические названия и завершённые ТЗ в реестре не хранятся — их история остаётся в Git.
