CREATE TABLE "BusinessStateMeta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "migrationVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessStateMeta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessPerson" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessPerson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessIdentityState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessIdentityState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessRecordEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessRecordEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessStateMeta_tenantId_key" ON "BusinessStateMeta"("tenantId");
CREATE UNIQUE INDEX "BusinessPerson_tenantId_key_key" ON "BusinessPerson"("tenantId", "key");
CREATE INDEX "BusinessPerson_tenantId_position_idx" ON "BusinessPerson"("tenantId", "position");
CREATE UNIQUE INDEX "BusinessIdentityState_tenantId_key" ON "BusinessIdentityState"("tenantId");
CREATE UNIQUE INDEX "BusinessRecord_tenantId_recordId_key" ON "BusinessRecord"("tenantId", "recordId");
CREATE INDEX "BusinessRecord_tenantId_position_idx" ON "BusinessRecord"("tenantId", "position");
CREATE UNIQUE INDEX "BusinessRecordEvent_tenantId_eventId_key" ON "BusinessRecordEvent"("tenantId", "eventId");
CREATE INDEX "BusinessRecordEvent_tenantId_recordId_idx" ON "BusinessRecordEvent"("tenantId", "recordId");
CREATE INDEX "BusinessRecordEvent_tenantId_position_idx" ON "BusinessRecordEvent"("tenantId", "position");

ALTER TABLE "BusinessStateMeta" ADD CONSTRAINT "BusinessStateMeta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessPerson" ADD CONSTRAINT "BusinessPerson_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessIdentityState" ADD CONSTRAINT "BusinessIdentityState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessRecord" ADD CONSTRAINT "BusinessRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessRecordEvent" ADD CONSTRAINT "BusinessRecordEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
