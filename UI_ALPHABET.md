# UI_ALPHABET

Это единственный словарь визуальных, интерактивных и навигационных сущностей приложения.
Если нужная сущность уже существует здесь, новая реализация запрещена.

## Геометрия приложения

| Код / компонент | Назначение | Единственный владелец |
|---|---|---|
| H | фон системы | `ui/v2` |
| A | аватар / контекст / настройки | `ui/header` |
| B | заголовок | `ui/header` |
| C | одно контекстное действие | `ui/header` |
| D | чат / утверждённое действие | `ui/header` |
| F | горизонтальная родительская навигация | `ui/v2` |
| E | вертикальная вложенная навигация | `ui/v2` |
| Z | рабочая поверхность | `ui/v2` |
| Z2/Z3… | рабочие слои поверх Z | `ui/v2` |
| Q | большой рабочий modal поверх Z-стека | `ui/modals` + `ui/v2` |
| X | нижний быстрый modal / action / select | `ui/modals` |
| S | верхний информационный modal | `ui/modals` |

## Shared UI владельцы

| Сущность | Единственный владелец |
|---|---|
| Accordion | `ui/accordion` |
| Auth UI | `ui/auth` |
| Booking UI shell | `ui/booking` |
| Button / IconButton / action button | `ui/buttons` |
| Calendar / DatePicker / DateNavigator | `ui/calendar` |
| EntityCard / FolderCard / MiniCard / card constructor | `ui/cards` |
| Chat UI | `ui/chat` |
| ColorPicker | `ui/colors` |
| Cost / стоимость / диапазон | `ui/cost` |
| Document / document viewer | `ui/documents` |
| Duration | `ui/duration` |
| Form layout / validation | `ui/forms` |
| Header A/B/C/D | `ui/header` |
| Info UI | `ui/info` |
| Field / Phone / Password / Textarea / Photo / File | `ui/inputs` |
| Layout / columns | `ui/layout` |
| Links | `ui/links` |
| List / v2ListEntry / v2ListEntries / reorder | `ui/lists` |
| Modal Q/X/S / Notice | `ui/modals` |
| Page / details / actionBlock | `ui/page` |
| Payment UI | `ui/payment` |
| Shared Profile actions | `ui/profile` |
| Receipt / readOnlyReceipt | `ui/receipt` |
| Record Z / Record steps / Record confirmation | `ui/record` |
| Repeated fields | `ui/repeated-fields` |
| SegmentControl / CheckList | `ui/selection` |
| Selector / SearchableSelector | `ui/selectors` |
| Shared Settings UI | `ui/settings` |
| StateView / EmptyState | `ui/states` |
| Tags | `ui/tags` |
| TimePicker / TimeSlots | `ui/time` |
| UEI UI | `ui/uei` |
| F/E/Z / CardDeck / HorizontalRail / Sticker / swipe physics | `ui/v2` |
| View navigation | `ui/view-navigation` |
| Workplace selector / workplace controls | `ui/workplaces` |
| UI facade only | `ui/ui.js` |
| UI utilities only | `ui/utils` |
| Visual reference only, never runtime owner | `ui/reference` |

## Calendar

- `ui/calendar` — единственный владелец `Calendar`, `DatePicker`, `DateNavigator` и геометрии навигации по дню / месяцу / году.
- Одна и та же Shared-навигация `← label →` используется независимо от данных: день, месяц, дата рождения, дата операции, дата записи и любой другой календарный контекст.
- Размер, border, radius, gap, typography и расположение стрелок задаются только `ui/calendar/calendar.css`; feature-код не имеет права переопределять их CSS, inline-style или modifier-классом.
- Feature-код может передать дату, режим, ограничения, callbacks и перенести уже готовый Shared calendar header в свой `Z Header`, но не имеет права менять его классы или визуальную геометрию.
- Локальные варианты вроде `compact`, feature-specific calendar navigation и собственные стрелки периода запрещены. Изменение Shared Calendar должно автоматически проявляться у всех его потребителей.
- Каноническая геометрия навигации Calendar: стрелки `36×36`, glyph `18`, border `1`, radius `8`, gap `4`; label `14/700`.

## Z Header / Z Body

- Каждый Z1/Z2/Z3… всегда состоит из двух Shared-частей: `Z Header` и `Z Body`.
- `Z Header` существует всегда как геометрическая зона, даже когда в нём пока нет пользовательского заголовка, поиска, переключателя или другого control.
- Минимальная высота `Z Header` — `40 px`. Она может увеличиваться только из-за реального содержимого Header.
- Shared tap-dismiss affordance `20×20 px` всегда живёт внутри `Z Header`; он не лежит поверх `Z Body` и не может наплывать на контент.
- После содержимого `Z Header` всегда остаётся финальный визуальный gap до начала `Z Body`.
- До отдельной миграции конкретного экрана всё текущее содержимое инструмента сначала принадлежит `Z Body`. Автоматически угадывать и переносить существующие controls в `Z Header` запрещено.
- В `Z Body` могут последовательно сочетаться проявления content / full / list. Это не разные типы Z, а разные проявления одной рабочей поверхности.
- Между соседними проявлениями `Z Body` обязателен визуальный gap, чтобы содержимое не сливалось.
- Проявление list, если присутствует, является терминальным: после list в `Z Body` нельзя размещать content или full.
- `Z Header` не является глобальным Header A/B/C/D и не принадлежит зоне H. Эти владельцы и геометрии независимы и не могут подменять друг друга.

## Жесты

- F: native horizontal scroll.
- E: native vertical scroll.
- E → вправо: закрыть E.
- Z1: переход к F только через Shared left-edge owner.
- Z2/Z3: left-edge закрывает только один верхний слой.
- Каждый Z1/Z2/Z3… получает один Shared tap-dismiss affordance в `Z Header`: прозрачная зона ровно `20×20 px`, без фона/рамки/плашки, с тихим серым указателем вправо.
- Tap по Shared Z affordance выполняет тот же один шаг возврата, что и успешный swipe вправо: Z3→Z2, Z2→Z1, Z1→F/E согласно текущему владельцу навигации. Отдельная tap-навигация запрещена.
- `Z Header` остаётся на месте при вертикальном scroll Z; `Z Body` движется независимо от него.
- Верхние sticky-элементы конкретного инструмента в будущем переносятся в `Z Header` только после ручной классификации эталонного экрана; feature-код не создаёт собственную параллельную верхнюю зону.
- Верхние `20 px` не принадлежат edge-swipe host, чтобы tap по affordance не спорил с распознаванием свайпа; ниже этой зоны left-edge swipe остаётся прежним.
- Z-content: native scroll без локального перехвата.
- HorizontalRail владеет своим горизонтальным scroll и не двигает Z.
- Один pointer gesture имеет только одного владельца.
- Нижний Z под открытым Z2/Z3 всегда inert и pointer-dead.
- Частично отведённый Z не делает F интерактивным.
- Открытый Q/X/S блокирует FEZ до полного закрытия modal.
- Feature-код не создаёт `pointerdown/pointermove/touch*`, `touch-action`, drag physics или screen-edge logic.

## Modal

- Feature-код вызывает только Shared modal API.
- Локальная modal geometry, backdrop, fixed-layer и собственное направление появления запрещены.
- Q/X/S не подменяются Z2/Z3 и наоборот.
- Нижний modal всегда X, верхний информационный всегда S, большой рабочий modal всегда Q.
- Поведение X определяется не фактом `X`, а его семантической ролью Shared modal: `action`, `editor`, `picker`.
- `X-action` — быстрый modal с кнопками действий. Когда выбранное действие открывает следующий X, `X-action` передаёт управление и закрывается; он не остаётся нижним слоем.
- `X-editor` — modal редактирования данных/формы. Открытый из его тела `X-picker` или другой дочерний выбор не закрывает `X-editor`; после закрытия дочернего X пользователь возвращается в тот же редактор с черновым выбранным значением.
- `X-picker` — выбор значения (например TimePicker/Selector). Он закрывает только себя и возвращает выбранное значение живому родительскому `X-editor`.
- `X-editor` сохраняет данные только по явному действию `Сохранить`/подтверждению, предусмотренному редактором. Swipe, tap по backdrop/вуали или другое обычное закрытие `X-editor` не является сохранением: несохранённый черновик отбрасывается, исходные данные остаются без изменений.
- Запрещено глобальное правило `если X уже открыт — второй X запрещён/заменяет первый`. Решение о handoff или stack принимает только Shared modal owner по семантической роли X.
- Разные application-modal Q/X/S могут открываться слоями, когда по контракту родитель должен оставаться живым; `X-action → X` является handoff, `X-editor → X-picker` является stack.
- Повторное открытие того же modal с той же идентичностью запрещено: одинаковый Q/X/S не дублируется в стеке.
- Пока существует стек Q/X/S, пользователь взаимодействует только с верхним активным modal; нижние modal, FEZ и Header под ним не выполняют собственные действия.
- Нажатие на backdrop/вуаль или любую область приложения вне тела активного modal закрывает только верхний modal и не передаёт исходное нажатие лежащим ниже modal/A/B/D/F/E/Z.
- Единственное исключение: открытый Q может оставить интерактивным принадлежащий текущему Q контекстный C. A/B/D при открытом Q остаются заблокированы; внешний tap по ним закрывает верхний modal.
- Полоса свайпа X/S занимает отдельное место в отступе Shared modal и не перекрывает содержимое.
- Каноническая проверка X-контракта — `scripts/check-modal-browser-interaction.mjs`: `X-action → X-editor → X-picker`, возврат picker в живой editor, отмена editor без сохранения, сохранение только кнопкой, Selector и реальный `openDayWorkplaceTime()` в Chromium desktop/mobile и WebKit mobile.

## CSS

- Feature CSS не создаёт копии Shared UI.
- Feature CSS может раскладывать только собственный контент.
- Геометрия Header/F/E/Z/modal/cards/lists/calendar/time/receipt/document меняется только у Shared owner.
- Мёртвый и неподключённый CSS запрещён.
- Удалённый CSS не может оставаться подключённым из HTML.

## Runtime

- Мёртвый JS запрещён: каждый runtime-модуль должен быть достижим от реального application entry.
- Transition bridge / legacy / compatibility runtime запрещены.
- Старые readiness flags/tables запрещены.
- Новый инструмент не получает отдельный storage/UI/gesture owner, если такой owner уже существует.

## Новая сущность

Новый UI-примитив допускается только когда:
1. существующего примитива действительно нет;
2. он зарегистрирован здесь;
3. назначен один Shared owner;
4. добавлен guard/test;
5. только после этого его использует функциональный инструмент.
