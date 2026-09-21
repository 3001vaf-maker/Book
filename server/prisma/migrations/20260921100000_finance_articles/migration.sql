CREATE TABLE "FinanceArticle" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "parentArticleId" TEXT NOT NULL DEFAULT '',
  "name" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "economicType" TEXT NOT NULL,
  "systemKey" TEXT NOT NULL DEFAULT '',
  "position" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceArticle_tenantId_articleId_key"
ON "FinanceArticle"("tenantId", "articleId");

CREATE INDEX "FinanceArticle_tenantId_parentArticleId_position_idx"
ON "FinanceArticle"("tenantId", "parentArticleId", "position");

CREATE INDEX "FinanceArticle_tenantId_direction_archivedAt_idx"
ON "FinanceArticle"("tenantId", "direction", "archivedAt");

ALTER TABLE "FinanceArticle"
ADD CONSTRAINT "FinanceArticle_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
