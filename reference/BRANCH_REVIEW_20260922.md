# Разбор старых веток Book — 22.09.2026

Цель разбора: оставить после очистки только:
- main
- staging
- reference/useful-ideas-20260922

## Правило отбора

Сохранялись не «все уникальные коммиты», а только продуктовые идеи, дизайн и полезные незавершённые решения.

Не сохранялись:
- старые реализации, которые текущий main уже заменил;
- миграции;
- recovery / hotfix / promote / promotion;
- диагностические и CI-ветки;
- старые юридические блокировки;
- старые версии Documents / Consents;
- старые версии Finance;
- старые identity / People / Profile рефакторы;
- временные проверки и тестовые ветки.

## Что проверено

### Ветки без уникальных коммитов относительно main

Их содержимое уже является частью истории main. Отдельные указатели веток не нужны.

### Юридический контур и согласия

Проверены ветки legal, messages-consent, pdn, consent cleanup и архивы до/после legal rebuild.

Не сохранять.

Причина: они содержат старые или промежуточные варианты правил, включая более жёсткие блокировки приложения. Источник истины — текущий main.

### Documents / DocumentArchive

Проверены старые repository/history/templates/archive ветки.

Не сохранять.

Текущий main содержит более новую архитектуру DocumentArchive / PlatformDocumentArchive / TenantDocumentArchive. Старые варианты не должны стать вторым источником истины.

### Finance

Проверены этапы F1–F12, settlement, ledger, articles, income/expense, payment history, refund, Z-report и ownership rebuild.

Не сохранять отдельно.

Актуальный main содержит более поздние версии соответствующих файлов и архитектуры; старые finance-документы не являются полезным отдельным ТЗ.

### Record / booking / time

Проверены:
- record status projection;
- public booking future slots;
- workplace timezone;
- record ownership cleanup.

Не сохранять отдельно.

Record status уже находится в main; future-slot логика в main новее; workplace timezone уже реализован в текущем контуре времени.

### Registration / DEMO / LIVE / First Run

Проверены старые и недавние first-run, registration, demo/live, live-request, clean-start, test-tenant и profile-cleanup ветки.

Не сохранять отдельно.

Это техническая история доведения текущего main до рабочего состояния. Старые варианты не должны конкурировать с текущей реализацией.

### Email / Postbox / приглашения

Проверены email-channel, Yandex Postbox, manual invitation и registration-link ветки.

Не сохранять отдельно.

Рабочие части уже находятся в main в более поздней форме.

### Синхронизация UI после изменений

Проверена feature/ui-post-mutation-sync-20260921.

Не сохранять отдельно: ключевые файлы server-sync и тест post-mutation-sync совпадают с текущим main.

### SaaS control plane / архитектурные словари / нейтральные названия

Проверены соответствующие feature/refactor ветки.

Не сохранять отдельно: актуальные документы и правила уже присутствуют в main.

### Recovery / hotfix / promotion / promote / verify / probe / diagnostics

Не сохранять.

Это история ремонта, проверки и доставки, а не самостоятельные продуктовые материалы.

## Что сохранено

1. UI Reference V2 — отдельный незавершённый дизайн.
2. Уведомления / непрочитанные / шаблоны / напоминания — сохранён продуктовый смысл без старого кода.
3. Non-blocking startup — сохранён принцип локальной ошибки модуля вместо бессмысленной блокировки всего Book.
4. Telegram Mini App / passwordless entry — сохранены как идеи для будущего, без старой реализации.

## Итог

После этого разбора старые ветки не нужны как рабочие или справочные источники.

Полезные незавершённые материалы собраны в reference/useful-ideas-20260922.
