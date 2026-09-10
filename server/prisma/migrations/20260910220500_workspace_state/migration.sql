CREATE TABLE "WorkspaceState" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceState_tenantId_userId_key" ON "WorkspaceState"("tenantId", "userId");
CREATE INDEX "WorkspaceState_tenantId_idx" ON "WorkspaceState"("tenantId");
CREATE INDEX "WorkspaceState_userId_idx" ON "WorkspaceState"("userId");
