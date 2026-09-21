BEGIN;

ALTER TABLE "PlatformDocumentVersion"
  ADD COLUMN IF NOT EXISTS "changeType" TEXT NOT NULL DEFAULT 'MATERIAL';

ALTER TABLE "PlatformDocumentVersion"
  ADD COLUMN IF NOT EXISTS "requiresAcceptance" BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlatformDocumentVersion_changeType_check'
  ) THEN
    ALTER TABLE "PlatformDocumentVersion"
      ADD CONSTRAINT "PlatformDocumentVersion_changeType_check"
      CHECK ("changeType" IN ('MATERIAL', 'BRAND_ONLY', 'EDITORIAL'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "AccountDocumentEvent" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "documentVersionId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT '',
  "technicalEvidence" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountDocumentEvent_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AccountDocumentEvent_documentVersionId_fkey"
    FOREIGN KEY ("documentVersionId") REFERENCES "PlatformDocumentVersion"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AccountDocumentEvent_action_check"
    CHECK ("action" IN ('ACCEPTED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountDocumentEvent_account_version_action_key"
  ON "AccountDocumentEvent"("accountId", "documentVersionId", "action");

CREATE INDEX IF NOT EXISTS "AccountDocumentEvent_account_occurredAt_idx"
  ON "AccountDocumentEvent"("accountId", "occurredAt");

CREATE INDEX IF NOT EXISTS "AccountDocumentEvent_documentVersion_idx"
  ON "AccountDocumentEvent"("documentVersionId", "occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'AccountDocumentEvent_append_only'
  ) THEN
    CREATE TRIGGER "AccountDocumentEvent_append_only"
    BEFORE UPDATE OR DELETE ON "AccountDocumentEvent"
    FOR EACH ROW EXECUTE FUNCTION "book_reject_document_registry_event_mutation"();
  END IF;
END
$$;

INSERT INTO "PlatformDocument" (
  "id", "key", "type", "title",
  "requiredForRegistration", "requiredForLive", "requiredForPublicBooking",
  "isActive", "createdAt", "updatedAt"
) VALUES (
  'platform-account-terms',
  'account-terms',
  'ACCOUNT_TERMS',
  'Условия использования учетной записи',
  true, false, false,
  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE
SET "type" = EXCLUDED."type",
    "title" = EXCLUDED."title",
    "requiredForRegistration" = EXCLUDED."requiredForRegistration",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlatformDocumentVersion" (
  "id", "documentId", "version", "contentSnapshot", "contentHash",
  "operatorIdentitySnapshot", "publishedAt", "changeType", "requiresAcceptance"
)
SELECT
  'platform-account-terms-v1',
  d."id",
  1,
  $terms$Условия использования учетной записи
Редакция 1 от 21.09.2026

1. Общие положения
Настоящие Условия регулируют использование учетной записи и профиля в программной платформе, оператором которой является Индивидуальный предприниматель Волоковых Александр Федорович, ИНН 230100433860, ОГРНИП 315230100024550. Контакт для юридически значимых обращений: a.volokovykh@yandex.ru.

2. Возможности учетной записи
Учетная запись позволяет пользователю:
• создавать и использовать собственный профиль;
• входить по поддерживаемым идентификаторам;
• хранить и изменять сведения собственного профиля;
• использовать один профиль в разных интерфейсах и каналах доступа платформы;
• взаимодействовать с отдельными пользователями платформы и пользоваться доступными функциями записи;
• просматривать доступную историю, сообщения, документы и настройки профиля в пределах предоставленных функций.

Канал входа, включая web-интерфейс или Telegram Mini App, не создает отдельную учетную запись и не меняет настоящие Условия.

3. Создание и безопасность учетной записи
Пользователь самостоятельно указывает принадлежащие ему контактные данные и отвечает за их актуальность. Один конкретный телефон, e-mail или технический Telegram ID не может одновременно принадлежать разным учетным записям платформы.
Пользователь обязан разумно защищать пароль и не передавать доступ к учетной записи посторонним лицам.

4. Акцепт
Учетная запись создается после явного принятия настоящих Условий в интерфейсе. Платформа фиксирует редакцию документа, идентификатор учетной записи, дату и время принятия, источник и необходимые технические доказательства.
Настоящие Условия не заменяют отдельные согласия или иные юридические действия, когда они требуются для конкретной операции.

5. Персональные данные
Персональные данные, объективно необходимые для создания и работы учетной записи, обрабатываются оператором в соответствии с применимым законодательством и Политикой обработки персональных данных оператора.
Данные, относящиеся к взаимодействию с конкретным пользователем платформы, обрабатываются в соответствующем отдельном контуре. Такие данные не переносятся автоматически между независимыми контурами.
Отдельные согласия на рекламу, распространение персональных данных и иные самостоятельные цели оформляются отдельно, когда они требуются.

6. Изменение данных профиля
Пользователь может изменять доступные данные собственного профиля. Контакт, добавленный самим пользователем в профиль, может использоваться платформой в уже существующих связанных контурах взаимодействия. Данные, внесенные другим пользователем платформы в собственном рабочем контуре, не добавляются автоматически в глобальный профиль.

7. Изменение Условий
Редакционные изменения, исправления ошибок и изменение отображаемого наименования платформы, которые не меняют стороны договора, существенные права и обязанности пользователя, цели использования учетной записи или обязательный состав обработки данных, не требуют повторного акцепта.
При существенном изменении Условий публикуется новая материальная редакция. До продолжения использования функций, для которых новая редакция необходима, платформа запрашивает новый явный акцепт.
История ранее принятых редакций не перезаписывается.

8. Прекращение использования
Пользователь может прекратить использование учетной записи и обратиться к оператору по вопросам удаления или ограничения обработки данных. Данные и юридические доказательства могут сохраняться только в объеме и на срок, необходимый по закону, для исполнения обязательств и защиты прав.

9. Заключительные положения
К отношениям сторон применяется право Российской Федерации. Обращения по настоящим Условиям направляются на a.volokovykh@yandex.ru.
$terms$,
  '6d0543f1cf07ee4c2d9f22557714abd109f834bb1d9b4281abd80e582acdabb7',
  '{"operator":"ИП Волоковых Александр Федорович","inn":"230100433860","ogrnip":"315230100024550","email":"a.volokovykh@yandex.ru"}'::jsonb,
  CURRENT_TIMESTAMP,
  'MATERIAL',
  true
FROM "PlatformDocument" d
WHERE d."key" = 'account-terms'
ON CONFLICT ("documentId", "version") DO NOTHING;

COMMIT;
