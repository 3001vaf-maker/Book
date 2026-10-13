CREATE TABLE "PasswordResetTicket" (
  "id" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetTicket_tokenHash_key" ON "PasswordResetTicket"("tokenHash");
CREATE INDEX "PasswordResetTicket_subject_idx" ON "PasswordResetTicket"("subjectType", "subjectId", "createdAt");
CREATE INDEX "PasswordResetTicket_expires_idx" ON "PasswordResetTicket"("expiresAt");
