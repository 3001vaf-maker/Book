-- Universal inventory foundation. Additive only: no legacy tables or columns are changed.
CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'шт.',
  "category" TEXT NOT NULL DEFAULT '',
  "sku" TEXT NOT NULL DEFAULT '',
  "barcode" TEXT NOT NULL DEFAULT '',
  "location" TEXT NOT NULL DEFAULT '',
  "supplier" TEXT NOT NULL DEFAULT '',
  "minStock" DECIMAL(14,3),
  "targetStock" DECIMAL(14,3),
  "packageQuantity" DECIMAL(14,3),
  "lastPurchasePrice" DECIMAL(14,4),
  "trackLots" BOOLEAN NOT NULL DEFAULT true,
  "canConsume" BOOLEAN NOT NULL DEFAULT true,
  "canSell" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryLot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "quantityReceived" DECIMAL(14,3) NOT NULL,
  "quantityRemaining" DECIMAL(14,3) NOT NULL,
  "unitCost" DECIMAL(14,4) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "supplier" TEXT NOT NULL DEFAULT '',
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "movementId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "sourceType" TEXT NOT NULL DEFAULT '',
  "sourceId" TEXT NOT NULL DEFAULT '',
  "originalMovementId" TEXT NOT NULL DEFAULT '',
  "personKey" TEXT NOT NULL DEFAULT '',
  "personUei" TEXT NOT NULL DEFAULT '',
  "recordId" TEXT NOT NULL DEFAULT '',
  "procedureKey" TEXT NOT NULL DEFAULT '',
  "workplaceKey" TEXT NOT NULL DEFAULT '',
  "note" TEXT NOT NULL DEFAULT '',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovementLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "inventoryMovementId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "lineId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "direction" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitCost" DECIMAL(14,4) NOT NULL,
  "amount" DECIMAL(16,4) NOT NULL,
  "expectedQuantity" DECIMAL(14,3),
  "actualQuantity" DECIMAL(14,3),
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovementLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovementAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "inventoryMovementLineId" TEXT NOT NULL,
  "inventoryLotId" TEXT NOT NULL,
  "allocationId" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitCost" DECIMAL(14,4) NOT NULL,
  "amount" DECIMAL(16,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovementAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryItem_tenantId_itemId_key" ON "InventoryItem"("tenantId", "itemId");
CREATE INDEX "InventoryItem_tenantId_archivedAt_position_idx" ON "InventoryItem"("tenantId", "archivedAt", "position");
CREATE INDEX "InventoryItem_tenantId_name_idx" ON "InventoryItem"("tenantId", "name");

CREATE UNIQUE INDEX "InventoryLot_tenantId_lotId_key" ON "InventoryLot"("tenantId", "lotId");
CREATE INDEX "InventoryLot_tenantId_inventoryItemId_receivedAt_idx" ON "InventoryLot"("tenantId", "inventoryItemId", "receivedAt");
CREATE INDEX "InventoryLot_tenantId_inventoryItemId_quantityRemaining_idx" ON "InventoryLot"("tenantId", "inventoryItemId", "quantityRemaining");

CREATE UNIQUE INDEX "InventoryMovement_tenantId_movementId_key" ON "InventoryMovement"("tenantId", "movementId");
CREATE INDEX "InventoryMovement_tenantId_occurredAt_idx" ON "InventoryMovement"("tenantId", "occurredAt");
CREATE INDEX "InventoryMovement_tenantId_sourceType_sourceId_idx" ON "InventoryMovement"("tenantId", "sourceType", "sourceId");
CREATE INDEX "InventoryMovement_tenantId_recordId_idx" ON "InventoryMovement"("tenantId", "recordId");

CREATE UNIQUE INDEX "InventoryMovementLine_tenantId_lineId_key" ON "InventoryMovementLine"("tenantId", "lineId");
CREATE INDEX "InventoryMovementLine_tenantId_inventoryMovementId_position_idx" ON "InventoryMovementLine"("tenantId", "inventoryMovementId", "position");
CREATE INDEX "InventoryMovementLine_tenantId_inventoryItemId_idx" ON "InventoryMovementLine"("tenantId", "inventoryItemId");

CREATE UNIQUE INDEX "InventoryMovementAllocation_tenantId_allocationId_key" ON "InventoryMovementAllocation"("tenantId", "allocationId");
CREATE INDEX "InventoryMovementAllocation_inventoryMovementLineId_idx" ON "InventoryMovementAllocation"("inventoryMovementLineId");
CREATE INDEX "InventoryMovementAllocation_inventoryLotId_idx" ON "InventoryMovementAllocation"("inventoryLotId");

ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovementLine" ADD CONSTRAINT "InventoryMovementLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovementAllocation" ADD CONSTRAINT "InventoryMovementAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovementLine" ADD CONSTRAINT "InventoryMovementLine_inventoryMovementId_fkey" FOREIGN KEY ("inventoryMovementId") REFERENCES "InventoryMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovementLine" ADD CONSTRAINT "InventoryMovementLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovementAllocation" ADD CONSTRAINT "InventoryMovementAllocation_inventoryMovementLineId_fkey" FOREIGN KEY ("inventoryMovementLineId") REFERENCES "InventoryMovementLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovementAllocation" ADD CONSTRAINT "InventoryMovementAllocation_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
