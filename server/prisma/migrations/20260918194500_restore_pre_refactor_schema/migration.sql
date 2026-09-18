BEGIN;

ALTER TYPE "MembershipRole" RENAME VALUE 'MEMBER' TO 'MASTER';
ALTER TYPE "UserInvitationStatus" RENAME TO "MasterInvitationStatus";
ALTER TABLE "TenantAccess" RENAME COLUMN "isPlatformOwnerWorkspace" TO "isOwnerBook";
ALTER TABLE "UserInvitation" RENAME TO "MasterInvitation";

ALTER TABLE "MasterInvitation" RENAME CONSTRAINT "UserInvitation_pkey" TO "MasterInvitation_pkey";
ALTER TABLE "MasterInvitation" RENAME CONSTRAINT "UserInvitation_tenantId_fkey" TO "MasterInvitation_tenantId_fkey";
ALTER TABLE "MasterInvitation" RENAME CONSTRAINT "UserInvitation_createdByAdminId_fkey" TO "MasterInvitation_createdByAdminId_fkey";
ALTER INDEX "UserInvitation_tokenHash_key" RENAME TO "MasterInvitation_tokenHash_key";
ALTER INDEX "UserInvitation_tenantId_idx" RENAME TO "MasterInvitation_tenantId_idx";
ALTER INDEX "UserInvitation_email_status_idx" RENAME TO "MasterInvitation_email_status_idx";
ALTER INDEX "UserInvitation_createdByAdminId_idx" RENAME TO "MasterInvitation_createdByAdminId_idx";

COMMIT;
