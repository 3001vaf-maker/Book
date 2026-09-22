import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tenantId = 'prelaunch-delete-tenant';
const accountId = 'prelaunch-delete-platform-account';
const membershipId = 'prelaunch-delete-membership';
const consentEventId = 'prelaunch-delete-consent';
const sessionId = 'prelaunch-delete-session';
const activityEventId = 'prelaunch-delete-activity';

try {
  await prisma.tenant.create({
    data: {
      id: tenantId,
      name: 'Prelaunch Active Live Tenant',
    },
  });

  await prisma.platformAccount.create({
    data: {
      id: accountId,
      email: 'prelaunch-delete@example.invalid',
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
      status: 'ACTIVE',
      isOwnerBook: false,
      commercialMode: 'LIVE',
    },
  });

  await prisma.platformSession.create({
    data: {
      id: sessionId,
      tenantId,
      platformAccountId: accountId,
    },
  });

  await prisma.platformActivityEvent.create({
    data: {
      id: activityEventId,
      tenantId,
      platformAccountId: accountId,
      sessionId,
      eventType: 'PRELAUNCH_DELETE_TEST',
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
      ${consentEventId},${tenantId},${accountId},'platform-account-terms-v1',
      'ACCEPTED','prelaunch-delete-test','{}'::jsonb,CURRENT_TIMESTAMP
    )
  `;

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

  const [tenant, account, consentEvents, activityEvents, sessions] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
    prisma.platformAccount.findUnique({ where: { id: accountId }, select: { id: true } }),
    prisma.$queryRaw`
      SELECT "id"
      FROM "PlatformConsentEvent"
      WHERE "id" = ${consentEventId}
    `,
    prisma.platformActivityEvent.findMany({
      where: { id: activityEventId },
      select: { id: true },
    }),
    prisma.platformSession.findMany({
      where: { id: sessionId },
      select: { id: true },
    }),
  ]);

  if (tenant) throw new Error('ACTIVE/LIVE Tenant was not deleted');
  if (account) throw new Error('Orphan PlatformAccount was not deleted');
  if (Array.isArray(consentEvents) && consentEvents.length) {
    throw new Error('PlatformConsentEvent test history remains');
  }
  if (activityEvents.length) throw new Error('PlatformActivityEvent test history remains');
  if (sessions.length) throw new Error('PlatformSession test row remains');

  console.log('ACTIVE/LIVE non-owner tenant hard delete leaves no test history');
} finally {
  await prisma.$disconnect();
}
