BEGIN;

ALTER TABLE "User" RENAME TO "PlatformAccount";
ALTER TABLE "PlatformAccount" RENAME CONSTRAINT "User_pkey" TO "PlatformAccount_pkey";
ALTER INDEX "User_email_key" RENAME TO "PlatformAccount_email_key";

ALTER TABLE "Membership" RENAME COLUMN "userId" TO "platformAccountId";
ALTER TABLE "Membership" RENAME CONSTRAINT "Membership_userId_fkey" TO "Membership_platformAccountId_fkey";
ALTER INDEX "Membership_tenantId_userId_key" RENAME TO "Membership_tenantId_platformAccountId_key";
ALTER INDEX "Membership_userId_idx" RENAME TO "Membership_platformAccountId_idx";

ALTER TABLE "WorkspaceState" RENAME COLUMN "userId" TO "platformAccountId";
ALTER INDEX "WorkspaceState_tenantId_userId_key" RENAME TO "WorkspaceState_tenantId_platformAccountId_key";
ALTER INDEX "WorkspaceState_userId_idx" RENAME TO "WorkspaceState_platformAccountId_idx";

ALTER TABLE "Profile" RENAME COLUMN "userId" TO "platformAccountId";
ALTER TABLE "Profile" RENAME CONSTRAINT "Profile_userId_fkey" TO "Profile_platformAccountId_fkey";
ALTER INDEX "Profile_tenantId_userId_key" RENAME TO "Profile_tenantId_platformAccountId_key";
ALTER INDEX "Profile_userId_idx" RENAME TO "Profile_platformAccountId_idx";

ALTER TABLE "PlatformAdmin" RENAME COLUMN "userId" TO "platformAccountId";
ALTER TABLE "PlatformAdmin" RENAME CONSTRAINT "PlatformAdmin_userId_fkey" TO "PlatformAdmin_platformAccountId_fkey";
ALTER INDEX "PlatformAdmin_userId_key" RENAME TO "PlatformAdmin_platformAccountId_key";

ALTER TABLE "PlatformConsentEvent" RENAME COLUMN "userId" TO "platformAccountId";
ALTER TABLE "PlatformConsentEvent" RENAME CONSTRAINT "PlatformConsentEvent_userId_fkey" TO "PlatformConsentEvent_platformAccountId_fkey";
ALTER INDEX "PlatformConsentEvent_user_occurredAt_idx" RENAME TO "PlatformConsentEvent_account_occurredAt_idx";

COMMIT;
