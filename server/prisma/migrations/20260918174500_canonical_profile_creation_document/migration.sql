BEGIN;

-- Keep platform-user consent and workspace document templates as separate concepts.
-- master-pd-consent was already neutralized to user-pd-consent by the prior migration.
-- No document is merged or deactivated here.

COMMIT;
