CREATE TABLE "CommunicationGroup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationGroup_tenantId_name_key"
  ON "CommunicationGroup"("tenantId", "name");
CREATE INDEX "CommunicationGroup_tenantId_updatedAt_idx"
  ON "CommunicationGroup"("tenantId", "updatedAt");

CREATE TABLE "CommunicationGroupMember" (
  "groupId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "personKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationGroupMember_pkey" PRIMARY KEY ("groupId", "personKey"),
  CONSTRAINT "CommunicationGroupMember_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "CommunicationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CommunicationGroupMember_tenantId_personKey_idx"
  ON "CommunicationGroupMember"("tenantId", "personKey");
