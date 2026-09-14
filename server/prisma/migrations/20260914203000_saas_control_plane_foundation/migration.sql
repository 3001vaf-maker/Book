CREATE TYPE "CapabilityValueType" AS ENUM ('BOOLEAN', 'LIMIT');
CREATE TYPE "TenantAccessStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "MasterInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

CREATE TABLE "PlatformAdmin" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Capability" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "groupKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "valueType" "CapabilityValueType" NOT NULL,
  "defaultEnabled" BOOLEAN NOT NULL DEFAULT false,
  "defaultLimit" INTEGER,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Capability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "position" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanCapability" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "capabilityId" TEXT NOT NULL,
  "enabled" BOOLEAN,
  "limit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlanCapability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantAccess" (
  "tenantId" TEXT NOT NULL,
  "planId" TEXT,
  "status" "TenantAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  "isOwnerBook" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantAccess_pkey" PRIMARY KEY ("tenantId")
);

CREATE TABLE "TenantCapabilityOverride" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "capabilityId" TEXT NOT NULL,
  "enabled" BOOLEAN,
  "limit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantCapabilityOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MasterInvitation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdByAdminId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "tokenHash" TEXT NOT NULL,
  "status" "MasterInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MasterInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdmin_userId_key" ON "PlatformAdmin"("userId");
CREATE UNIQUE INDEX "Capability_key_key" ON "Capability"("key");
CREATE INDEX "Capability_groupKey_position_idx" ON "Capability"("groupKey", "position");
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");
CREATE UNIQUE INDEX "PlanCapability_planId_capabilityId_key" ON "PlanCapability"("planId", "capabilityId");
CREATE INDEX "PlanCapability_capabilityId_idx" ON "PlanCapability"("capabilityId");
CREATE INDEX "TenantAccess_planId_idx" ON "TenantAccess"("planId");
CREATE INDEX "TenantAccess_status_idx" ON "TenantAccess"("status");
CREATE UNIQUE INDEX "TenantCapabilityOverride_tenantId_capabilityId_key" ON "TenantCapabilityOverride"("tenantId", "capabilityId");
CREATE INDEX "TenantCapabilityOverride_capabilityId_idx" ON "TenantCapabilityOverride"("capabilityId");
CREATE UNIQUE INDEX "MasterInvitation_tokenHash_key" ON "MasterInvitation"("tokenHash");
CREATE INDEX "MasterInvitation_tenantId_idx" ON "MasterInvitation"("tenantId");
CREATE INDEX "MasterInvitation_email_status_idx" ON "MasterInvitation"("email", "status");
CREATE INDEX "MasterInvitation_createdByAdminId_idx" ON "MasterInvitation"("createdByAdminId");

ALTER TABLE "PlatformAdmin"
  ADD CONSTRAINT "PlatformAdmin_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanCapability"
  ADD CONSTRAINT "PlanCapability_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanCapability"
  ADD CONSTRAINT "PlanCapability_capabilityId_fkey"
  FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantAccess"
  ADD CONSTRAINT "TenantAccess_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantAccess"
  ADD CONSTRAINT "TenantAccess_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenantCapabilityOverride"
  ADD CONSTRAINT "TenantCapabilityOverride_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "TenantAccess"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantCapabilityOverride"
  ADD CONSTRAINT "TenantCapabilityOverride_capabilityId_fkey"
  FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MasterInvitation"
  ADD CONSTRAINT "MasterInvitation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MasterInvitation"
  ADD CONSTRAINT "MasterInvitation_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
