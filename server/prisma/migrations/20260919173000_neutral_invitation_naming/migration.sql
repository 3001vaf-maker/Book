BEGIN;

ALTER TYPE "MasterInvitationStatus" RENAME TO "InvitationStatus";

ALTER TABLE "MasterInvitation" RENAME TO "Invitation";
ALTER TABLE "Invitation" RENAME CONSTRAINT "MasterInvitation_pkey" TO "Invitation_pkey";
ALTER TABLE "Invitation" RENAME CONSTRAINT "MasterInvitation_tenantId_fkey" TO "Invitation_tenantId_fkey";
ALTER TABLE "Invitation" RENAME CONSTRAINT "MasterInvitation_createdByAdminId_fkey" TO "Invitation_createdByAdminId_fkey";

ALTER INDEX "MasterInvitation_tokenHash_key" RENAME TO "Invitation_tokenHash_key";
ALTER INDEX "MasterInvitation_tenantId_idx" RENAME TO "Invitation_tenantId_idx";
ALTER INDEX "MasterInvitation_email_status_idx" RENAME TO "Invitation_email_status_idx";
ALTER INDEX "MasterInvitation_createdByAdminId_idx" RENAME TO "Invitation_createdByAdminId_idx";

COMMIT;
