BEGIN;

ALTER TABLE "Workplace"
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Workplace_tenant_deleted_position_idx"
ON "Workplace"("tenantId","deletedAt","position");

COMMIT;
