import { ForbiddenException } from '@nestjs/common';
import { CapabilityValueType, TenantAccessStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma.service';
import { SaasAccessService } from '../src/saas-access/saas-access.service';
import { FirstRunService } from '../src/first-run/first-run.service';

const prisma = new PrismaService();
const access = new SaasAccessService(prisma);
const firstRun = new FirstRunService(prisma, {} as any);

const tenantId = 'demo-live-regression-tenant';
const accountId = 'demo-live-regression-account';
const planId = 'demo-live-regression-plan';
const allowedId = 'demo-live-regression-allowed';
const deniedId = 'demo-live-regression-denied';
const scenarioId = 'demo-live-regression-scenario';
const versionId = 'demo-live-regression-version';

function capability(result: Awaited<ReturnType<SaasAccessService['resolveTenantAccess']>>, key: string) {
  const value = result.capabilities.find((item) => item.key === key);
  if (!value) throw new Error(`Capability missing: ${key}`);
  return value;
}

try {
  await prisma.$connect();

  await prisma.tenant.create({
    data: { id: tenantId, name: 'DEMO LIVE Regression' },
  });

  await prisma.platformAccount.create({
    data: {
      id: accountId,
      email: 'demo-live-regression@example.invalid',
      passwordHash: 'test-hash',
      onboardingStep: 3,
      workspaceUnlocked: true,
    },
  });

  await prisma.membership.create({
    data: {
      id: 'demo-live-regression-membership',
      tenantId,
      platformAccountId: accountId,
      role: 'OWNER',
    },
  });

  await prisma.plan.create({
    data: {
      id: planId,
      key: 'demo-live-regression-plan',
      name: 'DEMO LIVE Regression Plan',
    },
  });

  await prisma.capability.createMany({
    data: [
      {
        id: allowedId,
        key: 'demo-live.allowed',
        groupKey: 'regression',
        name: 'Allowed in LIVE',
        valueType: CapabilityValueType.BOOLEAN,
        defaultEnabled: false,
        position: 9901,
      },
      {
        id: deniedId,
        key: 'demo-live.denied',
        groupKey: 'regression',
        name: 'Denied in LIVE',
        valueType: CapabilityValueType.BOOLEAN,
        defaultEnabled: false,
        position: 9902,
      },
    ],
  });

  await prisma.planCapability.createMany({
    data: [
      {
        id: 'demo-live-regression-plan-allowed',
        planId,
        capabilityId: allowedId,
        enabled: true,
      },
      {
        id: 'demo-live-regression-plan-denied',
        planId,
        capabilityId: deniedId,
        enabled: false,
      },
    ],
  });

  const activatedAt = new Date();
  const demoExpiresAt = new Date(activatedAt.getTime() + 14 * 24 * 60 * 60 * 1000);

  await prisma.tenantAccess.create({
    data: {
      tenantId,
      planId,
      status: TenantAccessStatus.ACTIVE,
      isOwnerBook: false,
      commercialMode: 'DEMO',
      demoActivatedAt: activatedAt,
      demoExpiresAt,
    },
  });

  await prisma.firstRunScenario.create({
    data: {
      id: scenarioId,
      key: 'demo-live-regression',
      title: 'DEMO LIVE Regression',
    },
  });

  await prisma.firstRunScenarioVersion.create({
    data: {
      id: versionId,
      scenarioId,
      version: 1,
      status: 'PUBLISHED',
      publishedAt: activatedAt,
    },
  });

  await prisma.firstRunProgress.create({
    data: {
      id: 'demo-live-regression-progress',
      tenantId,
      platformAccountId: accountId,
      scenarioVersionId: versionId,
      status: 'IN_PROGRESS',
      currentStepKey: 'profile',
    },
  });

  const demo = await access.resolveTenantAccess(tenantId);
  const demoAllowed = capability(demo, 'demo-live.allowed');
  const demoDenied = capability(demo, 'demo-live.denied');

  if (demo.commercialMode !== 'DEMO') throw new Error('Expected DEMO mode');
  if (demoAllowed.enabled !== true || demoAllowed.source !== 'DEMO') {
    throw new Error('DEMO must open allowed capability from full Book access');
  }
  if (demoDenied.enabled !== true || demoDenied.source !== 'DEMO') {
    throw new Error('DEMO must also open capability that will be closed in LIVE');
  }

  let demoBlocked = false;
  try {
    await firstRun.assertRealOperationsAllowed(tenantId);
  } catch (error) {
    demoBlocked = error instanceof ForbiddenException;
  }
  if (!demoBlocked) throw new Error('DEMO must block real work operations');

  await prisma.tenantAccess.update({
    where: { tenantId },
    data: { commercialMode: 'LIVE' },
  });

  const live = await access.resolveTenantAccess(tenantId);
  const liveAllowed = capability(live, 'demo-live.allowed');
  const liveDenied = capability(live, 'demo-live.denied');

  if (live.commercialMode !== 'LIVE') throw new Error('Expected LIVE mode');
  if (liveAllowed.enabled !== true || liveAllowed.source !== 'PLAN') {
    throw new Error('LIVE must keep only actually allowed capability');
  }
  if (liveDenied.enabled !== false || liveDenied.source !== 'PLAN') {
    throw new Error('LIVE must close capability that is not allowed');
  }

  await firstRun.assertRealOperationsAllowed(tenantId);

  console.log('DEMO full access and LIVE allowed-access regression passed');
} finally {
  await prisma.$disconnect();
}
