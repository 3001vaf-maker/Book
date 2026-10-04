# UI_ALPHABET

Это единственный словарь визуальных и навигационных сущностей приложения.
Если нужная сущность уже есть здесь, новая реализация запрещена.

| Код / компонент | Назначение | Единственный владелец |
|---|---|---|
| H | фон системы | Shared V2 |
| A | контекст профиля/пространства | Shared Header |
| B | заголовок | Shared Header |
| C | одно контекстное действие | Shared Header |
| D | чат / утверждённое контекстное действие | Shared Header |
| F | горизонтальная родительская навигация | Shared CardDeck |
| E | вертикальная вложенная навигация | Shared CardDeck |
| Z | рабочая поверхность | Shared V2 |
| Z2/Z3… | рабочие слои поверх Z | Shared Z stack |
| Q | большой рабочий modal поверх Z-стека | Shared Modal/V2 |
| X | нижний быстрый modal / select / action | Shared Modal |
| S | верхний информационный modal | Shared Modal |
| CardDeck | карты F/E и их физика | `ui/v2` |
| EntityCard | основная сущностная карта | `ui/cards` |
| miniCard | мини-карта 238×144 | `ui/cards` |
| v2ListEntry | одна запись списка | `ui/lists` |
| v2ListEntries | список записей | `ui/lists` |
| Document | документ | `ui/documents` |
| Receipt | чек / отчётный лист | `ui/receipt` |
| Calendar | календарь | `ui/calendar` |
| TimePicker | время / диапазон | `ui/time` |
| Selector | выбор значения | `ui/selectors` |
| SegmentControl | переключатель вариантов | `ui/selection` |
| Toggle | да/нет | Shared settings/list UI |
| HorizontalRail | горизонтальный контент внутри Z | Shared V2/UI |

## Жесты

- F: native horizontal scroll.
- E: native vertical scroll.
- E → вправо: закрыть E.
- Z1: переход к F только через Shared left-edge owner.
- Z2/Z3: left-edge закрывает один верхний слой.
- Z-content: native scroll, без локального перехвата.
- HorizontalRail владеет своим горизонтальным scroll.
- Один pointer gesture может иметь только одного владельца.
- Feature-код не создаёт `pointerdown/pointermove/touch*`, `touch-action`, drag physics или screen-edge logic.

## Modal

- Feature-код вызывает только Shared modal API.
- Локальная modal geometry, backdrop, fixed-layer и собственное направление появления запрещены.
- Q/X/S не подменяются Z2/Z3 и наоборот.

## CSS

Feature CSS может раскладывать только собственный контент.
Он не переопределяет геометрию или физику Shared Header, F/E/Z, modal, cards, lists, calendar, time, receipt, document.

## Новая сущность

Новый UI-примитив допускается только когда:
1. существующего примитива действительно нет;
2. он добавлен сюда;
3. у него назначен один Shared owner;
4. добавлен guard/test;
5. только после этого его использует функциональный инструмент.
