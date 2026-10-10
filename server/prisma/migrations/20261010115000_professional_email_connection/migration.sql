CREATE TABLE "ProfessionalEmailConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "accessTokenTag" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL DEFAULT '',
    "refreshTokenIv" TEXT NOT NULL DEFAULT '',
    "refreshTokenTag" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT NOT NULL DEFAULT 'mail:smtp',
    "status" TEXT NOT NULL DEFAULT 'active',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalEmailConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalEmailConnection_tenantId_key"
    ON "ProfessionalEmailConnection"("tenantId");
CREATE INDEX "ProfessionalEmailConnection_platformAccountId_idx"
    ON "ProfessionalEmailConnection"("platformAccountId");

ALTER TABLE "ProfessionalEmailConnection"
    ADD CONSTRAINT "ProfessionalEmailConnection_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProfessionalEmailOAuthState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalEmailOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalEmailOAuthState_stateHash_key"
    ON "ProfessionalEmailOAuthState"("stateHash");
CREATE INDEX "ProfessionalEmailOAuthState_tenantId_idx"
    ON "ProfessionalEmailOAuthState"("tenantId");
CREATE INDEX "ProfessionalEmailOAuthState_expiresAt_idx"
    ON "ProfessionalEmailOAuthState"("expiresAt");

ALTER TABLE "ProfessionalEmailOAuthState"
    ADD CONSTRAINT "ProfessionalEmailOAuthState_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Some upgrade guards intentionally replay the pre-profile migration chain without
-- PlatformAccount present yet. Production/full-chain installs have it by this point,
-- so keep the account foreign keys when the relation exists without making those
-- guarded historical replays fail.
DO $$
BEGIN
    IF to_regclass('"PlatformAccount"') IS NOT NULL THEN
        ALTER TABLE "ProfessionalEmailConnection"
            ADD CONSTRAINT "ProfessionalEmailConnection_platformAccountId_fkey"
            FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        ALTER TABLE "ProfessionalEmailOAuthState"
            ADD CONSTRAINT "ProfessionalEmailOAuthState_platformAccountId_fkey"
            FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
