BEGIN;

ALTER TABLE "TenantConsentEvent"
DROP CONSTRAINT IF EXISTS "TenantConsentEvent_subjectType_check";

ALTER TABLE "TenantConsentEvent"
ADD CONSTRAINT "TenantConsentEvent_subjectType_check"
CHECK ("subjectType" IN ('BOOKING_ACCOUNT', 'ACCOUNT', 'CONTACT_POINT'));

COMMIT;
