# Book — архитектурный словарь

Этот документ фиксирует только актуальные понятия и границы ответственности Book. Детальные правила доменов находятся в `docs/DOMAIN_ARCHITECTURE_STANDARD.md`, визуальные правила — в `DESIGN_DICTIONARY.md`, реестр общих UI-функций — в `UI_FUNCTIONS_DICTIONARY.md`.

## 1. Базовые понятия

| Термин | Значение |
|---|---|
| FOLDER / Папка | Структурный раздел приложения. |
| DATA / Данные | Факты, принадлежащие конкретной сущности/домену. |
| CONTROLLER | Управляет сценарием/папкой, но не становится владельцем чужих бизнес-правил. |
| CORE DOMAIN | Канонический владелец бизнес-правил сложного домена. |
| MANIFESTATION | Экран/представление существующего домена. Не владеет его persistence или правилами. |
| UI | Общие визуальные компоненты и их представление. |

Одна сущность — один владелец — одна реализация. Нельзя создавать локальную копию существующего владельца, правила или UI-компонента.

## 2. Сложные Core-домены

Каноническая форма:

```text
core/<domain>/
├── внутренние атомы
└── index.js       ← единственный публичный контракт
```

Текущие сложные домены:
- `core/day/` — рабочий план/Day;
- `core/time/` — нейтральное время, TimeGrid, occupancy, availability;
- `core/record/` — Record, lifecycle, state/read, commands;
- `core/finance/` — Settlement/Расчёт, Ledger/DDS-факты, финансовые правила/команды; `Financial Model` зарезервирован для будущего аналитического план-факт инструмента.

Код из `journal/`, `timetable/`, `settings/`, `main/`, `ui/` обращается к сложному домену через его `index.js`, а не к внутренним `data.js`, `rules.js`, `service.js` и т. п.

## 3. Persistence

Бизнес-данные Book принадлежат серверу и PostgreSQL. Браузер не является владельцем бизнес-данных.

Разрешённое browser storage ограничено техническим/session/UI-состоянием, которое контролируется Check Book. Возврат бизнес-persistence в `localStorage`/`sessionStorage` запрещён.

`core/legacy-browser-business.js` — временная cleanup-функция: она не хранит бизнес-данные, а удаляет старые browser business keys после подтверждения всех серверных состояний.

## 4. UI

Общий UI имеет одну реализацию. Функциональные экраны используют существующие компоненты и не создают локальные дублеры.

**Shared manifestation invariance:** один и тот же Shared UI-owner всегда проявляется одинаково во всех контурах, профилях, рабочих пространствах и функциональных ветках. Контекст передаёт только данные, доступные действия и состояние; он не меняет геометрию, направление появления, жесты, тип modal, структуру кнопок или иной визуально-поведенческий контракт компонента. Если нужны разные проявления, это разные заранее определённые Shared UI-типы, а не локальные варианты одного owner.

Перед созданием нового общего UI необходимо проверить `UI_FUNCTIONS_DICTIONARY.md`.

### Shared FEZ navigation

F/E/Z navigation belongs only to the Shared V2 owner in `ui/v2` and is identical for the professional and end-user contours.

- **H** is the navigation background.
- **F and E use one Shared CardDeck card geometry.** E is never a compact or alternate card. Width, height, radius, surface, typography, icon placement, border and shadow are shared; only the deck axis changes.
- **F** is the horizontal instance of CardDeck. Normal movement is native `overflow-x` scrolling with platform inertia and `scroll-snap`.
- **E** is the vertical instance of the same CardDeck. Normal movement is native `overflow-y` scrolling with platform inertia and `scroll-snap`.
- Card depth is derived continuously from real geometry: distance from each card centre to the deck centre controls scale, Z-depth, subtle axis rotation, opacity, brightness, shadow and stacking order. The centred card is the single active front card and uses the canonical yellow outline. Neighboring cards visibly bend away and sit deeper instead of behaving like flat 2D tiles.
- F and E never use transform-by-index paging, velocity projection, manual scrollLeft/scrollTop paging or index-based decorative depth.
- A tap and a drag are different states. A drag never opens a card. Any clean tap on an F/E card selects and opens that card immediately; centring is a visual consequence of selection, never a required first tap. Native inertia may pass multiple cards; `scroll-snap-stop: always` is forbidden because it makes the deck feel stepped.
- An F card that owns nested sections shows the Shared nested-card indicator. Opening E does not mutate F into another card type: the entire F layer only moves visually deeper while the vertical E deck appears above it, forming one spatial cross.
- Right-swipe on E is cross-axis geometry, not a special hit-zone: it may begin anywhere on E and collapses E back to F after the horizontal intent is established.
- **Z keeps ownership of all of its internal vertical and horizontal data scrolling.** Z→F is therefore the one exception to free-start geometry: it is accepted only through one dedicated Shared 36 px left screen-edge owner. That edge zone uses `touch-action:none`; the rest of Z stays `touch-action:auto`, so horizontal rails and vertical content remain native. A swipe started in the middle of Z belongs to Z content, never to FE navigation.
- Z2/Z3 use the same Shared edge owner and close only the topmost Z level. Replacing a non-stacked Z must dispose its observer and gesture owner before DOM removal. Lower FEZ gestures are blocked while a stacked Z or modal is active.
- Opening navigation moves the existing Z/front fully offscreen to the right. Z geometry and vertical scroll position do not change.
- The FEZ scene is persistent. Selecting F/E must not destroy and recreate the complete shell with `innerHTML`; the existing F, Z and stage remain mounted while state/content changes. E is replaced only when its actual child set changes. A persistent scene may have exactly one active Shared FEZ interaction owner; the previous owner must be disposed before rebinding.
- Old parallel motion owners, separate F/E card implementations, compact E geometry, custom pager math, legacy gesture carry, index-based colour/depth tricks and stale compatibility selectors are forbidden after migration.

Functional screens may supply labels, children and state, but may not implement their own FEZ geometry, card type or gesture controller.

## 5. Workplace → Day → Calendar

`Workplace` владеет настройками рабочего пространства, включая его цвет и базовые параметры.

`Day` хранит конкретный рабочий факт даты и ссылку на Workplace; цвет в Day не копируется.

Calendar UI не владеет бизнес-смыслом индикатора. Контроллер передаёт готовые данные, Calendar только отображает их.

Рабочие даты и интервалы определяются через канонический Day/Time Core, а не локальными вычислениями Журнала или Графика.

## 6. Time / Availability

Все решения о доступности времени принадлежат `core/time/` и его публичному контракту.

TimeGrid нейтрален к Record, Break, Workplace и UI. Record/Break/Day передают факты через установленные контракты; экран не собирает собственный алгоритм свободного времени.

## 7. Record

Record — отдельный Core-домен. `journal/record.js`, `journal/record-view.js` и payment UI являются проявлениями/сценариями, а не владельцами Record persistence, lifecycle или финансовых формул.

## 8. Finance

Пользовательский раздел Finance живёт в `main/finance/`. Канонические скрытые бизнес-правила Finance принадлежат `core/finance/` и доступны наружу только через публичный контракт домена.

Канонические понятия:
- Settlement / Расчёт — сумма начисления, скидка, к оплате, оплачено, возврат и задолженность по конкретному источнику;
- Ledger / DDS — каждый фактический входящий/исходящий денежный факт;
- Operation — объединяет связанные Ledger-строки одной экономической операции;
- Articles / Статьи — расширяемая пользователем классификация с отдельным системным экономическим характером;
- Wallet / Касса — метаданные кошельков; баланс и история являются проекцией Ledger;
- Z-report — отчётная проекция Ledger за день/период;
- Financial Model / Финансовая модель — **зарезервированный будущий аналитический инструмент** для планов, факта, отклонений и анализа; он не участвует в проведении оплаты и не владеет Record/Ledger.

Record хранит факт записи и необходимые source snapshots, но не является владельцем денежного движения или независимого payment truth.

F2 удаляет legacy-атом `core/finance/model.js` и старые Record-oriented `FinancialPlan/plan-fact` API. Операционный расчёт называется только `Settlement / Расчёт`. Legacy JSON-поля `record.finance`, `planAmount`, `planTotal`, `fact*` временно сохраняются как совместимость хранения до следующих этапов и не означают Financial Model.

Старые параллельные владельцы `core/dds.js`, `core/financial-model.js`, `core/payment.js` запрещены. Настоящая Financial Model не создаётся до отдельного будущего проекта.

## 9. Навигация и BACK

Навигация отвечает только за переход между существующими разделами. `BACK` возвращает на один предыдущий уровень и не меняет доменную структуру самостоятельно.

Нижняя навигация и скрытые будущие разделы — часть продукта, а не основание для удаления кода.

## 10. Припаркованные продуктовые области

Следующие части намеренно сохранены для дальнейшей разработки и не являются мусором:
- `chat/` — будущий Чат / интеграция чат-бота;
- `settings/warehouse/` — Склад;
- `settings/loyalty/` — расширение Лояльности.

Скрытый или минимальный UI не означает, что папку можно удалить.

## 11. Проверка архитектуры

`npm run check` запускает структурные guard-скрипты из `scripts/`. `npm test` запускает регрессии из `tests/`.

Guard/test не являются временными ТЗ и не удаляются только потому, что задача, из которой они появились, уже завершена. Их назначение — не дать старой архитектуре вернуться.

## 12. Рабочий процесс

```text
feature/staging branch
→ Check Book
→ staging/manual verification
→ merge в main
→ один production deploy
```

`main` — production. Промежуточная разработка в `main` запрещена.


## 13. PROFILE — нейтральность профессии

`Profile` — универсальная системная сущность. Профессия является только данными профиля: `Profile.profession`.

Жёстко запрещено использовать профессию как системное понятие:
- в имени сущности, модели, роли, маршрута, ID, переменной, сервиса или файла;
- в общем названии экрана, раздела, кабинета, заголовка, навигации, CTA или системного текста;
- для выбора архитектуры, владельца данных или поведения домена.

Разрешено только отображать значение `Profile.profession` как данные самого профиля там, где профессия действительно является содержимым карточки/формы.

Формулировка продуктового запроса вида «кабинет парикмахера», «экран тренера», «раздел врача» не является разрешением создавать профессиональное системное название. Если неясно, является слово примером пользователя или требованием к системному термину, сначала уточняется смысл.

`scripts/check-profile-profession-neutrality.mjs` автоматически запрещает:
- значения из каталога профессий Profile вне самого каталога;
- ряд типичных профессиональных обозначений как системные литералы;
- использование поля `profession` для построения title/header/aria/route и другой системной структуры.

## 14. Journal → WorkPlan → Availability → TimeGrid → UI

Каноническая цепочка планирования и занятого времени:

```text
Journal / Timetable
        ↓
WorkPlan: core/day/index.js
        ↓
Availability: core/time/index.js
        ↓
TimeGrid: internal core/time/grid.js
        ↓
Shared Time / Calendar UI
```

`Journal` и `Timetable` передают факты и запускают сценарии, но не создают собственные правила пересечений или доступности. `WorkPlan` владеет рабочим временем дня. `Availability` является публичным контрактом вопроса «можно ли занять это время?». `TimeGrid` — внутренний нейтральный механизм минутной сетки и не знает о конкретных UI/фичах.

Record — hard occupancy, Break — soft occupancy в нейтральном time-usage contract. UI получает готовое состояние/варианты времени и не определяет владельца минуты самостоятельно.

**Обычное продуктовое ТЗ не является разрешением менять эту архитектуру.** Если требуется новое архитектурное правило, сначала изменяется канонический Core-контракт и его guard, а затем все потребители; локальный обход запрещён.


## 15. PEOPLE — Account / Person / UEI

`People` — канонический домен людей, с которыми работает Book. Это название домена/множества, а не отдельный тип записи.

Канонические понятия:
- `Account` — входящий аккаунт: конкретная учётная точка входа человека в Book; Account не является Person или UEI;
- `Person` — одна рабочая бизнес-единица внутри People;
- `UEI` — канонический код идентичности, связывающий несколько Person-записей, когда они явно признаны одной идентичностью;
- один Person может быть связан с одним или несколькими Account;
- один Account может быть точкой входа к нескольким отдельным Person/UEI, например при общем семейном контакте; это не объединяет их между собой;
- совпадение нормализованного контакта позволяет распознать уже известный Account/контакт, но само по себе не является доказательством тождества Person и не должно автоматически объединять Person или UEI;
- связывание и разъединение Person через UEI выполняется явно и не должно терять Record, Finance, Communication, Documents/Consents или другую историю.

Жёстко запрещено использовать как системные понятия People:
- `Client`, `Clients`, `ClientCard`, `clientId`, `client*` как имя бизнес-сущности, модели, маршрута, переменной, сервиса или файла;
- профессиональные варианты вроде Patient, Student, Customer и т. п.

Разрешённые исключения:
- пользовательский UI-label папки People; значение по умолчанию может быть «Клиенты» и позднее настраиваться пользователем;
- собственное имя production-host `client.va-tools.ru`;
- сторонний пакет `@prisma/client` и тип `PrismaClient`;
- стандартный Web API Service Worker `self.clients` / локальная переменная `client` при работе именно с Web API client objects;
- неизменяемые уже применённые Prisma migrations;
- юридические документы прошлых редакций до отдельного юридического изменения версии.

UEI имеет одного владельца идентичности. Параллельное самостоятельное хранение текущего UEI в Account или другой сущности запрещено; потребители получают актуальную UEI-связь из канонического identity owner.

Обычное переименование не является разрешением менять бизнес-поведение People/Account/UEI. Сначала сохраняется и проверяется существующая логика идентификации, затем меняется терминология и контракты.
