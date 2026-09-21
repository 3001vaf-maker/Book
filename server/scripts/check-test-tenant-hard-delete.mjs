import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tenantId = 'hard-delete-tenant';
const accountId = 'hard-delete-platform-account';
const membershipId = 'hard-delete-membership';
const tenantEventId = 'hard-delete-consent-tenant';
const platformEventId = 'hard-delete-consent-platform';

function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

try {
  await prisma.tenant.create({
    data: {
      id: tenantId,
      name: 'Hard Delete Test Tenant',
    },
  });

  await prisma.platformAccount.create({
    data: {
      id: accountId,
      email: 'hard-delete-test@example.invalid',
      passwordHash: 'test-hash',
      onboardingStep: 3,
      workspaceUnlocked: true,
    },
  });

  await prisma.membership.create({
    data: {
      id: membershipId,
      tenantId,
      platformAccountId: accountId,
      role: 'OWNER',
    },
  });

  await prisma.tenantAccess.create({
    data: {
      tenantId,
      isOwnerBook: false,
      commercialMode: 'DEMO',
    },
  });

  const versions = await prisma.$queryRaw`
    SELECT "id"
    FROM "PlatformDocumentVersion"
    WHERE "id" = 'platform-account-terms-v1'
    LIMIT 1
  `;
  if (!Array.isArray(versions) || !versions.length) {
    throw new Error('platform-account-terms-v1 is missing');
  }

  await prisma.$executeRaw`
    INSERT INTO "PlatformConsentEvent" (
      "id","tenantId","platformAccountId","documentVersionId",
      "action","source","technicalEvidence","occurredAt"
    ) VALUES (
      ${tenantEventId},${tenantId},${accountId},'platform-account-terms-v1',
      'ACCEPTED','hard-delete-test','{}'::jsonb,CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "PlatformConsentEvent" (
      "id","tenantId","platformAccountId","documentVersionId",
      "action","source","technicalEvidence","occurredAt"
    ) VALUES (
      ${platformEventId},NULL,${accountId},'platform-account-terms-v1',
      'ACCEPTED','hard-delete-test','{}'::jsonb,CURRENT_TIMESTAMP
    )
  `;

  let appendOnlyBlocked = false;
  try {
    await prisma.$executeRaw`
      DELETE FROM "PlatformConsentEvent"
      WHERE "id" = ${tenantEventId}
    `;
  } catch (error) {
    const text = messageOf(error);
    appendOnlyBlocked = text.includes('append-only');
  }
  if (!appendOnlyBlocked) {
    throw new Error('PlatformConsentEvent ordinary DELETE was not blocked by append-only guard');
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL "book.allow_test_tenant_delete" = \'on\'');

    const guard = await tx.$queryRaw`
      SELECT current_setting('book.allow_test_tenant_delete', true) AS "value"
    `;
    if (!Array.isArray(guard) || guard[0]?.value !== 'on') {
      throw new Error('Test tenant delete guard was not enabled inside transaction');
    }

    await tx.$executeRaw`
      DELETE FROM "PlatformConsentEvent"
      WHERE "tenantId" = ${tenantId}
    `;

    await tx.tenant.delete({ where: { id: tenantId } });

    const remainingMemberships = await tx.membership.count({
      where: { platformAccountId: accountId },
    });
    const platformAdmin = await tx.platformAdmin.findUnique({
      where: { platformAccountId: accountId },
      select: { id: true },
    });

    if (remainingMemberships !== 0 || platformAdmin) {
      throw new Error('Test PlatformAccount unexpectedly remains referenced after Tenant delete');
    }

    await tx.$executeRaw`
      DELETE FROM "PlatformConsentEvent"
      WHERE "platformAccountId" = ${accountId}
    `;

    await tx.platformAccount.delete({ where: { id: accountId } });
  });

  const [tenant, account, events] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
    prisma.platformAccount.findUnique({ where: { id: accountId }, select: { id: true } }),
    prisma.$queryRaw`
      SELECT "id"
      FROM "PlatformConsentEvent"
      WHERE "id" IN (${tenantEventId}, ${platformEventId})
    `,
  ]);

  if (tenant) throw new Error('Tenant was not deleted');
  if (account) throw new Error('Orphan PlatformAccount was not deleted');
  if (Array.isArray(events) && events.length) throw new Error('PlatformConsentEvent rows were not deleted');

  console.log('Guarded registered tenant hard delete passed');
} finally {
  await prisma.$disconnect();
}
