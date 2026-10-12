import { PrismaClient, MembershipRole } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = String(process.env.OWNER_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.OWNER_PASSWORD || '');
  const tenantName = String(process.env.OWNER_TENANT_NAME || 'VA').trim() || 'VA';

  if (!email) {
    throw new Error('OWNER_EMAIL is required');
  }

  const existing = await prisma.platformAccount.findUnique({
    where: { email },
    include: { memberships: { orderBy: { createdAt: 'asc' } } },
  });

  if (existing?.memberships?.[0]) {
    await prisma.tenantAccess.upsert({
      where: { tenantId: existing.memberships[0].tenantId },
      create: {
        tenantId: existing.memberships[0].tenantId,
        status: 'ACTIVE',
        isOwnerBook: true,
        commercialMode: 'LIVE',
      },
      update: {
        status: 'ACTIVE',
        isOwnerBook: true,
        commercialMode: 'LIVE',
      },
    });
    return;
  }

  if (existing) {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: tenantName } });
      await tx.membership.create({
        data: { tenantId: tenant.id, platformAccountId: existing.id, role: MembershipRole.OWNER },
      });
      await tx.tenantAccess.create({
        data: {
          tenantId: tenant.id,
          status: 'ACTIVE',
          isOwnerBook: true,
          commercialMode: 'LIVE',
        },
      });
    });
    return;
  }

  if (password.length < 10) {
    throw new Error('OWNER_PASSWORD (minimum 10 characters) is required for initial owner creation');
  }

  const passwordHash = await hash(password, 12);
  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: tenantName } });
    const account = await tx.platformAccount.create({
      data: { email, passwordHash },
    });
    await tx.membership.create({
      data: { tenantId: tenant.id, platformAccountId: account.id, role: MembershipRole.OWNER },
    });
    await tx.tenantAccess.create({
      data: {
        tenantId: tenant.id,
        status: 'ACTIVE',
        isOwnerBook: true,
        commercialMode: 'LIVE',
      },
    });
  });
}

main()
  .finally(() => prisma.$disconnect());
