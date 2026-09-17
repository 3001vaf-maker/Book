CREATE TABLE "TestTenant" (
  "tenantId" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestTenant_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION "book_block_test_tenant_live"()
RETURNS trigger AS $$
BEGIN
  IF NEW."operationMode" = 'LIVE'
     AND EXISTS (SELECT 1 FROM "TestTenant" t WHERE t."tenantId" = NEW."tenantId") THEN
    RAISE EXCEPTION 'TEST tenant cannot enter LIVE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_block_test_tenant_live" ON "TenantLegalState";
CREATE TRIGGER "trg_block_test_tenant_live"
BEFORE INSERT OR UPDATE OF "operationMode" ON "TenantLegalState"
FOR EACH ROW EXECUTE FUNCTION "book_block_test_tenant_live"();
