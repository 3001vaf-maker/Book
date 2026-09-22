BEGIN;

DO $documents_step$
BEGIN
  IF to_regclass('"FirstRunStep"') IS NOT NULL
     AND to_regclass('"FirstRunScenarioVersion"') IS NOT NULL THEN
    UPDATE "FirstRunStep" step
    SET
      "modalTitle" = 'Документы и персональные данные',
      "modalBody" = 'Здесь хранятся документы, их версии и история действий. К этому этапу Book уже подготовил персональную PDF-инструкцию по уведомлению Роскомнадзора на основании данных вашего профиля и услуг. Она сохранена в «Документы → Инструкции» и доступна для повторного скачивания. Перед использованием проверьте, что ваша фактическая работа и собираемые данные совпадают со сведениями в инструкции. Рекламное согласие является отдельным и понадобится только для соответствующих маркетинговых отправок.',
      "metadata" = COALESCE(step."metadata", '{}'::jsonb) - 'rknGuide'
    WHERE step."key" = 'documents'
      AND step."scenarioVersionId" IN (
        SELECT version."id"
        FROM "FirstRunScenarioVersion" version
        WHERE version."status" = 'PUBLISHED'
      );
  END IF;
END
$documents_step$;

COMMIT;
