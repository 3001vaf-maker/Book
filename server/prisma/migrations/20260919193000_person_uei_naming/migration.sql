ALTER TABLE "BusinessPerson" RENAME TO "Person";
ALTER INDEX "BusinessPerson_pkey" RENAME TO "Person_pkey";
ALTER INDEX "BusinessPerson_tenantId_key_key" RENAME TO "Person_tenantId_key_key";
ALTER INDEX "BusinessPerson_tenantId_position_idx" RENAME TO "Person_tenantId_position_idx";

ALTER TABLE "BusinessIdentityState" RENAME TO "UeiState";
ALTER INDEX "BusinessIdentityState_pkey" RENAME TO "UeiState_pkey";
ALTER INDEX "BusinessIdentityState_tenantId_key" RENAME TO "UeiState_tenantId_key";
