-- Commercial catalog is the source of truth for saleable tools, folders and packages.
-- Pricing is mutable in the current draft; published snapshots remain immutable.

CREATE TABLE "CommercialProduct" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSaleable" BOOLEAN NOT NULL DEFAULT false,
  "isFree" BOOLEAN NOT NULL DEFAULT true,
  "priceMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "source" TEXT NOT NULL DEFAULT 'APP',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialProduct_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommercialProduct_type_check" CHECK ("type" IN ('SYSTEM','TOOL','FOLDER','PACKAGE','CAPACITY','ADDON')),
  CONSTRAINT "CommercialProduct_price_check" CHECK ("priceMinor" >= 0)
);

CREATE UNIQUE INDEX "CommercialProduct_key_key" ON "CommercialProduct"("key");
CREATE INDEX "CommercialProduct_type_position_idx" ON "CommercialProduct"("type", "position");

CREATE TABLE "CommercialProductCapability" (
  "productId" TEXT NOT NULL,
  "capabilityKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialProductCapability_pkey" PRIMARY KEY ("productId", "capabilityKey")
);
CREATE INDEX "CommercialProductCapability_capabilityKey_idx" ON "CommercialProductCapability"("capabilityKey");
ALTER TABLE "CommercialProductCapability"
  ADD CONSTRAINT "CommercialProductCapability_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "CommercialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommercialProductInclusion" (
  "parentProductId" TEXT NOT NULL,
  "childProductId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialProductInclusion_pkey" PRIMARY KEY ("parentProductId", "childProductId"),
  CONSTRAINT "CommercialProductInclusion_not_self" CHECK ("parentProductId" <> "childProductId")
);
CREATE INDEX "CommercialProductInclusion_childProductId_idx" ON "CommercialProductInclusion"("childProductId");
ALTER TABLE "CommercialProductInclusion"
  ADD CONSTRAINT "CommercialProductInclusion_parentProductId_fkey"
  FOREIGN KEY ("parentProductId") REFERENCES "CommercialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialProductInclusion"
  ADD CONSTRAINT "CommercialProductInclusion_childProductId_fkey"
  FOREIGN KEY ("childProductId") REFERENCES "CommercialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommercialCatalogPublication" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdByAdminId" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialCatalogPublication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommercialCatalogPublication_version_key" ON "CommercialCatalogPublication"("version");
ALTER TABLE "CommercialCatalogPublication"
  ADD CONSTRAINT "CommercialCatalogPublication_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommercialTenantTerms" (
  "tenantId" TEXT NOT NULL,
  "discountPercent" INTEGER NOT NULL DEFAULT 0,
  "freeForever" BOOLEAN NOT NULL DEFAULT false,
  "freeUntil" TIMESTAMP(3),
  "livePaidStartsAt" TIMESTAMP(3),
  "updatedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialTenantTerms_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "CommercialTenantTerms_discount_check" CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100)
);
ALTER TABLE "CommercialTenantTerms"
  ADD CONSTRAINT "CommercialTenantTerms_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialTenantTerms"
  ADD CONSTRAINT "CommercialTenantTerms_updatedByAdminId_fkey"
  FOREIGN KEY ("updatedByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommercialTenantProduct" (
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialTenantProduct_pkey" PRIMARY KEY ("tenantId", "productId")
);
CREATE INDEX "CommercialTenantProduct_productId_idx" ON "CommercialTenantProduct"("productId");
ALTER TABLE "CommercialTenantProduct"
  ADD CONSTRAINT "CommercialTenantProduct_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialTenantProduct"
  ADD CONSTRAINT "CommercialTenantProduct_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "CommercialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommercialOrder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
  "discountPercent" INTEGER NOT NULL DEFAULT 0,
  "discountMinor" INTEGER NOT NULL DEFAULT 0,
  "totalMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "catalogVersion" INTEGER,
  "liveStartsAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommercialOrder_amounts_check" CHECK ("subtotalMinor" >= 0 AND "discountMinor" >= 0 AND "totalMinor" >= 0),
  CONSTRAINT "CommercialOrder_discount_check" CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100)
);
CREATE INDEX "CommercialOrder_tenantId_createdAt_idx" ON "CommercialOrder"("tenantId", "createdAt");
ALTER TABLE "CommercialOrder"
  ADD CONSTRAINT "CommercialOrder_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialOrder"
  ADD CONSTRAINT "CommercialOrder_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommercialOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productKey" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "priceMinor" INTEGER NOT NULL DEFAULT 0,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "totalMinor" INTEGER NOT NULL DEFAULT 0,
  "snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "CommercialOrderItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommercialOrderItem_orderId_idx" ON "CommercialOrderItem"("orderId");
ALTER TABLE "CommercialOrderItem"
  ADD CONSTRAINT "CommercialOrderItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "CommercialOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommercialPayment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'INTERNAL',
  "providerPaymentId" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "amountMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "walletKey" TEXT NOT NULL DEFAULT '',
  "occurredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommercialPayment_amount_check" CHECK ("amountMinor" >= 0)
);
CREATE INDEX "CommercialPayment_orderId_createdAt_idx" ON "CommercialPayment"("orderId", "createdAt");
ALTER TABLE "CommercialPayment"
  ADD CONSTRAINT "CommercialPayment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "CommercialOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommercialAuditEvent" (
  "id" TEXT NOT NULL,
  "actorAdminId" TEXT,
  "tenantId" TEXT,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL DEFAULT '',
  "entityId" TEXT NOT NULL DEFAULT '',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercialAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommercialAuditEvent_occurredAt_idx" ON "CommercialAuditEvent"("occurredAt");
CREATE INDEX "CommercialAuditEvent_tenantId_occurredAt_idx" ON "CommercialAuditEvent"("tenantId", "occurredAt");
ALTER TABLE "CommercialAuditEvent"
  ADD CONSTRAINT "CommercialAuditEvent_actorAdminId_fkey"
  FOREIGN KEY ("actorAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommercialAuditEvent"
  ADD CONSTRAINT "CommercialAuditEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
