BEGIN;

ALTER TYPE "MembershipRole" RENAME VALUE 'MASTER' TO 'MEMBER';
ALTER TYPE "MasterInvitationStatus" RENAME TO "UserInvitationStatus";
ALTER TABLE "TenantAccess" RENAME COLUMN "isOwnerBook" TO "isPlatformOwnerWorkspace";
ALTER TABLE "MasterInvitation" RENAME TO "UserInvitation";

ALTER TABLE "UserInvitation" RENAME CONSTRAINT "MasterInvitation_pkey" TO "UserInvitation_pkey";
ALTER TABLE "UserInvitation" RENAME CONSTRAINT "MasterInvitation_tenantId_fkey" TO "UserInvitation_tenantId_fkey";
ALTER TABLE "UserInvitation" RENAME CONSTRAINT "MasterInvitation_createdByAdminId_fkey" TO "UserInvitation_createdByAdminId_fkey";
ALTER INDEX "MasterInvitation_tokenHash_key" RENAME TO "UserInvitation_tokenHash_key";
ALTER INDEX "MasterInvitation_tenantId_idx" RENAME TO "UserInvitation_tenantId_idx";
ALTER INDEX "MasterInvitation_email_status_idx" RENAME TO "UserInvitation_email_status_idx";
ALTER INDEX "MasterInvitation_createdByAdminId_idx" RENAME TO "UserInvitation_createdByAdminId_idx";

UPDATE "Capability"
SET "key" = 'people.access',
    "groupKey" = 'people',
    "name" = 'Люди',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'clients.access';

UPDATE "Plan"
SET "key" = 'starter-base',
    "name" = 'Старт',
    "description" = 'Профиль, услуги, люди и одно рабочее пространство',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'starter-clients';

COMMIT;
