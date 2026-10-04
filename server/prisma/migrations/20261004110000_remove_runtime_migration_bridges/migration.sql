ALTER TABLE "Profile" DROP COLUMN IF EXISTS "migrationVerifiedAt";
ALTER TABLE "BusinessStateMeta" DROP COLUMN IF EXISTS "migrationVerifiedAt";
ALTER TABLE "BusinessOperationalState" DROP COLUMN IF EXISTS "migrationVerifiedAt";
ALTER TABLE "TenantDocumentArchive" DROP COLUMN IF EXISTS "migrationVerifiedAt";
ALTER TABLE "BusinessAuxiliaryState" DROP COLUMN IF EXISTS "migrationVerifiedAt";
