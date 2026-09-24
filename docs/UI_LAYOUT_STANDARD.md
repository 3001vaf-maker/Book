# Book — UI Layout Standard

## twoColumnLayout()

`twoColumnLayout()` — канонический общий UI-контейнер для двух равных колонок.

Он отвечает только за геометрию:

- две равные колонки;
- единая горизонтальная ось для соответствующих элементов;
- одинаковый промежуток между колонками;
- адаптация к узкому экрану без локальных CSS-правил;
- содержимое колонок компоненту неизвестно.

Внутри каждой колонки может находиться любой уже существующий UI: `timePicker()`, `field()`, `select()`, стоимость, текстовый блок или другой общий компонент.

Пример принципа:

```text
[ заголовок 1 ]   [ заголовок 2 ]
[   любой UI  ]   [   любой UI  ]
```

Владелец реализации: `ui/layout/`.

Публичный вызов: `twoColumnLayout()` через `ui/ui.js`.

Запрещено:

- собирать собственную копию `.two-column-layout` в функциональном разделе;
- задавать геометрию этого контейнера в `journal/`, `timetable/`, `settings/` или других функциональных папках;
- привязывать компонент к конкретной сущности или типу данных;
- превращать его в `timeRange`-компонент: время является только одним из возможных наполнений.

Первое утверждённое использование: `График → Конфликт времени`.

Другие существующие двухколоночные блоки переводятся на этот эталон отдельно по мере проверки, без массового изменения поведения.


## Shared mobile shell: H / F / E / Z

Рабочий мобильный интерфейс имеет одну системную оболочку: Shared V2 `H + FE + Z`.

Функциональные разделы, которые открываются внутри Z, передают только содержимое и источники действий. Им запрещено создавать внутри Z второй `appShell`, второй `appHeader`, собственный viewport-height screen, локальный fixed-layer или собственную touch-policy.

Канонические владельцы:

- Header / F / E / Z / свайпы: `ui/v2/`;
- контекст Header/Back: `workspaceHeaderContext()` из `ui/header/`;
- модальные окна: `modal()/mountModal()`;
- вертикальный scroll рабочего содержимого принадлежит Z, кроме явно ограниченных внутренних списков.

### Матрица обязательной проверки FE/Z

Перед выпуском изменения Shared owner проверяются все его рабочие потребители, а не один контрольный экран.

| F | E / экран | F swipe | E swipe | Z swipe | vertical scroll | modal owner | shared header |
|---|---|---|---|---|---|---|---|
| Люди | основной экран | owner | — | owner | Z | Shared | Shared |
| Финансы | Касса | owner | owner | owner | Z | Shared | Shared |
| Финансы | ДДС | owner | owner | owner | Z | Shared | Shared |
| Финансы | Доход / Расход | owner | owner | owner | Z | Shared | Shared |
| Финансы | Статьи | owner | owner | owner | Z | Shared | Shared |
| Финансы | Прочие операции | owner | owner | owner | Z | Shared | Shared |
| Финансы | Z-отчёт | owner | owner | owner | Z | Shared | Shared |
| График | основной экран | owner | — | owner | Z | Shared | Shared |
| Журнал | День | owner | owner | owner | Z | Shared | Shared |
| Журнал | Месяц | owner | owner | owner | Z | Shared | Shared |
| Журнал | Список | owner | owner | owner | Z + ограниченный список | Shared | Shared |
| Профиль | основной Z + Z2 | owner | — | owner | Z/Z2 | Shared | Shared |
| Настройки | Сервис | owner | owner | owner | Z | Shared | Shared |
| Настройки | Онлайн-запись | owner | owner | owner | Z | Shared | Shared |
| Настройки | Уведомления | owner | owner | owner | Z | Shared | Shared |
| Настройки | Интеграции | owner | owner | owner | Z | Shared | Shared |
| Настройки | Документы | owner | owner | owner | Z | Shared | Shared |
| Настройки | Ярлыки | owner | owner | owner | Z | Shared | Shared |

### Release gate

При любом изменении Shared owner:

1. перечислить всех потребителей owner по репозиторию;
2. проверить отсутствие вложенных fullscreen-shell/header/fixed/touch owners;
3. пройти все F и E маршруты;
4. проверить Z swipe, вертикальный scroll, модалки и Header;
5. считать CI необходимым, но не достаточным условием;
6. не выпускать в `main`, пока эта матрица не закрыта.

`scripts/check-ui-v2-architecture.mjs` автоматически блокирует повторное появление второго `appShell/appHeader`, локального viewport-height/fixed/touch owner в рабочих functional-модулях.
