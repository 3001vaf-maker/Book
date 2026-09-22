import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tenantId = 'immutable-history-tenant';
const accountId = 'immutable-history-platform-account';
const membershipId = 'immutable-history-membership';
const eventId = 'immutable-history-consent';

function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

try {
  await prisma.tenant.create({
    data: {
      id: tenantId,
      name: 'Immutable History Tenant',
    },
  });

  await prisma.platformAccount.create({
    data: {
      id: accountId,
      email: 'immutable-history@example.invalid',
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
      ${eventId},${tenantId},${accountId},'platform-account-terms-v1',
      'ACCEPTED','immutable-history-test','{}'::jsonb,CURRENT_TIMESTAMP
    )
  `;

  let appendOnlyBlocked = false;
  try {
    await prisma.$executeRaw`
      DELETE FROM "PlatformConsentEvent"
      WHERE "id" = ${eventId}
    `;
  } catch (error) {
    appendOnlyBlocked = messageOf(error).includes('append-only');
  }
  if (!appendOnlyBlocked) {
    throw new Error('PlatformConsentEvent ordinary DELETE was not blocked');
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenant.delete({ where: { id: tenantId } });

    const remainingMemberships = await tx.membership.count({
      where: { platformAccountId: accountId },
    });
    const platformAdmin = await tx.platformAdmin.findUnique({
      where: { platformAccountId: accountId },
      select: { id: true },
    });

    if (remainingMemberships !== 0 || platformAdmin) {
      throw new Error('PlatformAccount unexpectedly remains referenced after Tenant delete');
    }

    await tx.platformAccount.delete({ where: { id: accountId } });
  });

  const [tenant, account, events] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
    prisma.platformAccount.findUnique({ where: { id: accountId }, select: { id: true } }),
    prisma.$queryRaw`
      SELECT "id","tenantId","platformAccountId"
      FROM "PlatformConsentEvent"
      WHERE "id" = ${eventId}
    `,
  ]);

  if (tenant) throw new Error('Tenant was not deleted');
  if (account) throw new Error('Orphan PlatformAccount was not deleted');
  if (!Array.isArray(events) || events.length !== 1) {
    throw new Error('Immutable PlatformConsentEvent history was not preserved');
  }
  if (events[0].tenantId !== tenantId || events[0].platformAccountId !== accountId) {
    throw new Error('Immutable PlatformConsentEvent identifiers were rewritten');
  }

  console.log('Immutable legal history survives tenant/account deletion');
} finally {
  await prisma.$disconnect();
}
