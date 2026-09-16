import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

function hash(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

async function main() {
  const email = String(process.env.OWNER_EMAIL || 'staging@book.local').trim().toLowerCase();
  const owner = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true },
  });
  const tenantId = owner?.memberships?.[0]?.tenantId;
  if (!owner || !tenantId) throw new Error('Run seed:owner before seed-staging-publication');

  // This seed is only for the isolated Docker staging smoke. Production migrations remain
  // fail-closed: PRE_LAUNCH + DEMO + NOT_PREPARED. Here we explicitly construct a synthetic
  // legally-ready environment so public-booking/chat/legal regression tests exercise LIVE paths.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "PlatformLegalState"
      SET "status" = 'LEGAL_READY',
          "filingStatus" = 'SUBMITTED',
          "checklist" = '{
            "operatorDocumentsPublished": true,
            "privacyPolicyPublished": true,
            "consentFormsPrepared": true,
            "saasAgreementPublished": true,
            "dpaPublished": true,
            "operatorIdentityConfigured": true,
            "rknFilingConfirmed": true,
            "productionInfrastructureChecked": true
          }'::jsonb,
          "submittedAt" = CURRENT_TIMESTAMP,
          "submissionReference" = 'STAGING-SYNTHETIC-NOT-A-REAL-FILING',
          "evidenceMetadata" = '{"synthetic":true,"environment":"staging-smoke"}'::jsonb,
          "legalReadyAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'platform'
    `;

    const platformDocuments = [
      { key: 'privacy-policy', type: 'PRIVACY_POLICY', title: 'Synthetic staging privacy policy', required: true },
      { key: 'saas-agreement', type: 'SAAS_AGREEMENT', title: 'Synthetic staging SaaS agreement', required: true },
      { key: 'dpa', type: 'DPA', title: 'Synthetic staging DPA', required: true },
      { key: 'master-pd-consent', type: 'PD_CONSENT', title: 'Synthetic staging master PD consent', required: true },
      { key: 'marketing-consent', type: 'MARKETING_CONSENT', title: 'Synthetic staging marketing consent', required: false },
    ];

    for (const item of platformDocuments) {
      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "LegalDocument"
        WHERE "scope" = 'PLATFORM' AND "tenantId" IS NULL AND "key" = ${item.key}
        LIMIT 1
      `;
      const documentId = existing[0]?.id || randomUUID();
      if (!existing[0]) {
        await tx.$executeRaw`
          INSERT INTO "LegalDocument" (
            "id", "scope", "tenantId", "key", "type", "title",
            "requiredForRegistration", "requiredForLive", "requiredForPublicBooking",
            "isActive", "createdAt", "updatedAt"
          ) VALUES (
            ${documentId}, 'PLATFORM', NULL, ${item.key}, ${item.type}, ${item.title},
            ${item.required}, false, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
      }

      const version = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "LegalDocumentVersion"
        WHERE "documentId" = ${documentId} AND "supersededAt" IS NULL
        LIMIT 1
      `;
      if (!version[0]) {
        const content = `Synthetic staging-only ${item.key}. This is test evidence and is not a production legal document.`;
        await tx.$executeRaw`
          INSERT INTO "LegalDocumentVersion" (
            "id", "documentId", "version", "contentSnapshot", "contentHash",
            "operatorIdentitySnapshot", "publishedAt", "supersededAt"
          ) VALUES (
            ${randomUUID()}, ${documentId}, 1, ${content}, ${hash(content)},
            '{"name":"Book Staging","synthetic":true}'::jsonb,
            CURRENT_TIMESTAMP, NULL
          )
        `;
      }
    }

    await tx.$executeRaw`
      INSERT INTO "TenantLegalState" (
        "tenantId", "operationMode", "filingStatus", "checklist",
        "preparedAt", "submittedAt", "submissionReference",
        "evidenceMetadata", "liveAt", "updatedAt"
      ) VALUES (
        ${tenantId}, 'LIVE', 'SUBMITTED',
        '{
          "operatorIdentityConfigured": true,
          "privacyPolicyPublished": true,
          "clientDocumentsPrepared": true,
          "dpaAccepted": true,
          "rknFilingPrepared": true
        }'::jsonb,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
        'STAGING-SYNTHETIC-NOT-A-REAL-FILING',
        '{"synthetic":true,"environment":"staging-smoke"}'::jsonb,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("tenantId") DO UPDATE SET
        "operationMode" = 'LIVE',
        "filingStatus" = 'SUBMITTED',
        "checklist" = EXCLUDED."checklist",
        "preparedAt" = CURRENT_TIMESTAMP,
        "submittedAt" = CURRENT_TIMESTAMP,
        "submissionReference" = EXCLUDED."submissionReference",
        "evidenceMetadata" = EXCLUDED."evidenceMetadata",
        "liveAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    const existingDocument = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "LegalDocument"
      WHERE "scope" = 'TENANT' AND "tenantId" = ${tenantId} AND "key" = 'privacy-policy'
      LIMIT 1
    `;
    const documentId = existingDocument[0]?.id || randomUUID();
    if (!existingDocument[0]) {
      await tx.$executeRaw`
        INSERT INTO "LegalDocument" (
          "id", "scope", "tenantId", "key", "type", "title",
          "requiredForRegistration", "requiredForLive", "requiredForPublicBooking",
          "isActive", "createdAt", "updatedAt"
        ) VALUES (
          ${documentId}, 'TENANT', ${tenantId}, 'privacy-policy', 'PRIVACY_POLICY',
          'Synthetic staging privacy policy', false, true, true, true,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
    }

    const existingVersion = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "LegalDocumentVersion"
      WHERE "documentId" = ${documentId} AND "supersededAt" IS NULL
      LIMIT 1
    `;
    if (!existingVersion[0]) {
      const content = 'Synthetic staging-only privacy policy. No real personal data is intended for this environment.';
      await tx.$executeRaw`
        INSERT INTO "LegalDocumentVersion" (
          "id", "documentId", "version", "contentSnapshot", "contentHash",
          "operatorIdentitySnapshot", "publishedAt", "supersededAt"
        ) VALUES (
          ${randomUUID()}, ${documentId}, 1, ${content}, ${hash(content)},
          '{"name":"Book Staging","synthetic":true}'::jsonb,
          CURRENT_TIMESTAMP, NULL
        )
      `;
    }

    await tx.bookingPublication.upsert({
      where: { tenantId },
      create: {
        tenantId,
        revision: 1,
        data: { stagingSynthetic: true } as Prisma.InputJsonValue,
      },
      update: {
        data: { stagingSynthetic: true } as Prisma.InputJsonValue,
      },
    });
  });

  console.log('Synthetic staging LEGAL_READY + LIVE publication is active.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
