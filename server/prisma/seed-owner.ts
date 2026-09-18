import { PrismaClient, MembershipRole, TenantAccessStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = String(process.env.OWNER_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.OWNER_PASSWORD || '');
  const tenantName = String(process.env.OWNER_TENANT_NAME || 'Book').trim() || 'Book';

  if (!email || password.length < 10) {
    throw new Error('OWNER_EMAIL and OWNER_PASSWORD (minimum 10 characters) are required');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const membership = await prisma.membership.findFirst({
      where: { userId: existing.id, role: MembershipRole.OWNER },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) {
      throw new Error('Configured OWNER_EMAIL exists but has no OWNER membership; refusing implicit platform-admin promotion');
    }
    await prisma.$transaction(async (tx) => {
      await tx.tenantAccess.upsert({
        where: { tenantId: membership.tenantId },
        create: {
          tenantId: membership.tenantId,
          status: TenantAccessStatus.ACTIVE,
          isPlatformOwnerWorkspace: true,
        },
        update: {
          status: TenantAccessStatus.ACTIVE,
          isPlatformOwnerWorkspace: true,
        },
      });
      await tx.platformAdmin.upsert({
        where: { userId: existing.id },
        create: { userId: existing.id },
        update: {},
      });
    });
    return;
  }

  const passwordHash = await hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: tenantName } });
    const user = await tx.user.create({
      data: { email, passwordHash, workspaceUnlocked: true },
    });
    await tx.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: MembershipRole.OWNER },
    });
    await tx.tenantAccess.create({
      data: {
        tenantId: tenant.id,
        status: TenantAccessStatus.ACTIVE,
        isPlatformOwnerWorkspace: true,
      },
    });
    await tx.platformAdmin.create({ data: { userId: user.id } });
  });
}

main()
  .finally(() => prisma.$disconnect());
