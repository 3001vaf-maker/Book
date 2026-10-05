-- Additive warehouse master-data extension: product identity, packaging physics,
-- supplier offers, and frozen purchase conditions. Existing inventory history stays intact.

ALTER TABLE "InventoryItem"
  ADD COLUMN "manufacturer" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "productType" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "grossWeight" DECIMAL(14,3),
  ADD COLUMN "tareWeight" DECIMAL(14,3);

ALTER TABLE "InventoryLot"
  ADD COLUMN "listPrice" DECIMAL(14,4),
  ADD COLUMN "discountPercent" DECIMAL(7,4);

CREATE TABLE "InventorySupplierOffer" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "supplier" TEXT NOT NULL,
  "listPrice" DECIMAL(14,4),
  "discountPercent" DECIMAL(7,4),
  "actualPrice" DECIMAL(14,4),
  "supplierSku" TEXT NOT NULL DEFAULT '',
  "note" TEXT NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventorySupplierOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryItem_tenantId_manufacturer_name_idx"
  ON "InventoryItem"("tenantId", "manufacturer", "name");

CREATE UNIQUE INDEX "InventorySupplierOffer_tenantId_offerId_key"
  ON "InventorySupplierOffer"("tenantId", "offerId");
CREATE INDEX "InventorySupplierOffer_tenantId_inventoryItemId_supplier_idx"
  ON "InventorySupplierOffer"("tenantId", "inventoryItemId", "supplier");
CREATE INDEX "InventorySupplierOffer_tenantId_supplier_idx"
  ON "InventorySupplierOffer"("tenantId", "supplier");

ALTER TABLE "InventorySupplierOffer"
  ADD CONSTRAINT "InventorySupplierOffer_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventorySupplierOffer"
  ADD CONSTRAINT "InventorySupplierOffer_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
