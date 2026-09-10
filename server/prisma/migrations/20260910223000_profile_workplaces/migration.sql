CREATE TABLE "Profile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL DEFAULT 'profile',
  "name" TEXT NOT NULL DEFAULT '',
  "surname" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "phones" JSONB NOT NULL,
  "telegrams" JSONB NOT NULL,
  "emails" JSONB NOT NULL,
  "about" TEXT NOT NULL DEFAULT '',
  "photo" TEXT NOT NULL DEFAULT '',
  "profession" TEXT NOT NULL DEFAULT '',
  "experience" TEXT NOT NULL DEFAULT '',
  "professionAbout" TEXT NOT NULL DEFAULT '',
  "customProfessions" JSONB NOT NULL,
  "migrationVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workplace" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "photo" TEXT NOT NULL DEFAULT '',
  "name" TEXT NOT NULL DEFAULT '',
  "color" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "from" TEXT NOT NULL DEFAULT '09:00',
  "to" TEXT NOT NULL DEFAULT '18:00',
  "links" JSONB NOT NULL,
  "about" TEXT NOT NULL DEFAULT '',
  "sourceCreatedAt" TEXT NOT NULL DEFAULT '',
  "sourceUpdatedAt" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Workplace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Profile_tenantId_userId_key" ON "Profile"("tenantId", "userId");
CREATE UNIQUE INDEX "Profile_id_tenantId_key" ON "Profile"("id", "tenantId");
CREATE INDEX "Profile_tenantId_idx" ON "Profile"("tenantId");
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

CREATE UNIQUE INDEX "Workplace_tenantId_key_key" ON "Workplace"("tenantId", "key");
CREATE INDEX "Workplace_tenantId_idx" ON "Workplace"("tenantId");
CREATE INDEX "Workplace_profileId_idx" ON "Workplace"("profileId");

ALTER TABLE "Profile"
  ADD CONSTRAINT "Profile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Profile"
  ADD CONSTRAINT "Profile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Workplace"
  ADD CONSTRAINT "Workplace_profileId_tenantId_fkey"
  FOREIGN KEY ("profileId", "tenantId") REFERENCES "Profile"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
