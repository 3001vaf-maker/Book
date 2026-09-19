BEGIN;

ALTER TYPE "MasterInvitationStatus" RENAME TO "TenantInvitationStatus";

ALTER TABLE "MasterInvitation" RENAME TO "TenantInvitation";
ALTER TABLE "TenantInvitation" RENAME CONSTRAINT "MasterInvitation_pkey" TO "TenantInvitation_pkey";
ALTER TABLE "TenantInvitation" RENAME CONSTRAINT "MasterInvitation_tenantId_fkey" TO "TenantInvitation_tenantId_fkey";
ALTER TABLE "TenantInvitation" RENAME CONSTRAINT "MasterInvitation_createdByAdminId_fkey" TO "TenantInvitation_createdByAdminId_fkey";

ALTER INDEX "MasterInvitation_tokenHash_key" RENAME TO "TenantInvitation_tokenHash_key";
ALTER INDEX "MasterInvitation_tenantId_idx" RENAME TO "TenantInvitation_tenantId_idx";
ALTER INDEX "MasterInvitation_email_status_idx" RENAME TO "TenantInvitation_email_status_idx";
ALTER INDEX "MasterInvitation_createdByAdminId_idx" RENAME TO "TenantInvitation_createdByAdminId_idx";

COMMIT;
