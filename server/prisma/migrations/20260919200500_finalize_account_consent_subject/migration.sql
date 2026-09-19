BEGIN;

UPDATE "TenantConsentEvent"
SET "subjectType" = 'ACCOUNT'
WHERE "subjectType" = 'BOOKING_ACCOUNT';

ALTER TABLE "TenantConsentEvent"
DROP CONSTRAINT IF EXISTS "TenantConsentEvent_subjectType_check";

ALTER TABLE "TenantConsentEvent"
ADD CONSTRAINT "TenantConsentEvent_subjectType_check"
CHECK ("subjectType" IN ('ACCOUNT', 'CONTACT_POINT'));

COMMIT;
