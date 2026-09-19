ALTER TABLE "BookingAccount" RENAME TO "Account";

ALTER INDEX "BookingAccount_pkey" RENAME TO "Account_pkey";
ALTER INDEX "BookingAccount_tenantId_email_key" RENAME TO "Account_tenantId_email_key";
ALTER INDEX "BookingAccount_tenantId_idx" RENAME TO "Account_tenantId_idx";
ALTER INDEX "BookingAccount_tenantId_phone_idx" RENAME TO "Account_tenantId_phone_idx";

ALTER TABLE "BookingRequest"
RENAME CONSTRAINT "BookingRequest_accountId_fkey" TO "BookingRequest_accountId_Account_fkey";

UPDATE "TenantConsentEvent"
SET "subjectType" = 'ACCOUNT'
WHERE "subjectType" = 'BOOKING_ACCOUNT';
