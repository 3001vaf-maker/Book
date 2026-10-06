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

## Жесты

- F: native horizontal scroll.
- E: native vertical scroll.
- E → вправо: закрыть E.
- Z1: переход к F только через Shared left-edge owner.
- Z2/Z3: left-edge закрывает только один верхний слой.
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
- Одновременно может существовать только один application-modal Q/X/S. Открытие нового application-modal сначала закрывает текущий; стек из нескольких Q/X/S запрещён.
- Пока Q/X/S открыт, пользователь может взаимодействовать только с содержимым активного modal. FEZ и Header под ним не выполняют собственные действия.
- Нажатие на backdrop/вуаль или любую область приложения вне тела активного modal закрывает этот modal и не передаёт исходное нажатие лежащему под ним A/B/D/F/E/Z.
- Единственное исключение: открытый Q может оставить интерактивным принадлежащий текущему Q контекстный C. A/B/D при открытом Q остаются заблокированы; внешний tap по ним закрывает Q.
- Полоса свайпа X/S занимает отдельное место в отступе Shared modal и не перекрывает содержимое. Проверка попадания в элементы, перехода меню → рабочие пространства и касаний: `scripts/check-modal-browser-interaction.mjs` (Chromium desktop/mobile, WebKit mobile).

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
