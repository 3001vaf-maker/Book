CREATE TYPE "BookingRequestStatus" AS ENUM ('PENDING', 'IMPORTED', 'REJECTED', 'CANCELLED');

CREATE TABLE "BookingPublication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingPublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "surname" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "telegramId" TEXT NOT NULL DEFAULT '',
    "consents" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "workplaceKey" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "procedures" JSONB NOT NULL,
    "status" "BookingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "importedRecordId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingPublication_tenantId_key" ON "BookingPublication"("tenantId");
CREATE UNIQUE INDEX "BookingAccount_tenantId_email_key" ON "BookingAccount"("tenantId", "email");
CREATE INDEX "BookingAccount_tenantId_idx" ON "BookingAccount"("tenantId");
CREATE INDEX "BookingAccount_tenantId_phone_idx" ON "BookingAccount"("tenantId", "phone");
CREATE INDEX "BookingRequest_tenantId_status_idx" ON "BookingRequest"("tenantId", "status");
CREATE INDEX "BookingRequest_tenantId_workplaceKey_date_idx" ON "BookingRequest"("tenantId", "workplaceKey", "date");
CREATE INDEX "BookingRequest_accountId_idx" ON "BookingRequest"("accountId");

ALTER TABLE "BookingPublication" ADD CONSTRAINT "BookingPublication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingAccount" ADD CONSTRAINT "BookingAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BookingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
