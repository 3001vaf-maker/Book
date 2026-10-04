# PROJECT_STATE

## Обязательный контракт

- Рабочая ветка только `staging`. Production только `main`. Другие рабочие ветки запрещены.
- Новый функционал собирается из существующего Shared UI. Локальный клон существующего UI запрещён.
- F/E/Z, свайпы, CardDeck, modal geometry и viewport geometry имеют одного владельца: Shared UI.
- Feature-код не создаёт собственный глобальный pointer/touch owner, fixed/full-screen слой, modal geometry или canonical component CSS.
- A/B/C/D, F/E/Z, Q/X/S, CardDeck, EntityCard, miniCard, v2ListEntry/v2ListEntries, Calendar, TimePicker, Receipt и Document используются только через Shared UI.
- Runtime `legacy`, `bridge`, `compat`, `migration`, migrate/verify/bootstrap-переходы запрещены. Исторические Prisma migrations сохраняются как история БД и не являются runtime.
- Бизнес-данные принадлежат серверу/PostgreSQL. Browser storage — только session/technical/UI state.
- Новое общее UI-проявление сначала создаётся в Shared UI и получает guard/test; только потом используется инструментом.
- CI обязан падать при попытке вернуть запрещённую архитектуру.
- Перед `main`: `npm run check`, `npm test`, browser runtime tests и фактическая проверка затронутых контуров.
