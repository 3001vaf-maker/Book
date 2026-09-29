CREATE TYPE "BookingPublicRouteType" AS ENUM ('PROFILE', 'WORKPLACE');

CREATE TABLE "BookingPublicRoute" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "entityType" "BookingPublicRouteType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingPublicRoute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingPublicRoute_entityType_entityId_key"
  ON "BookingPublicRoute"("entityType", "entityId");

CREATE UNIQUE INDEX "BookingPublicRoute_scopeKey_slug_key"
  ON "BookingPublicRoute"("scopeKey", "slug");

CREATE INDEX "BookingPublicRoute_tenantId_entityType_idx"
  ON "BookingPublicRoute"("tenantId", "entityType");

ALTER TABLE "BookingPublicRoute"
  ADD CONSTRAINT "BookingPublicRoute_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
