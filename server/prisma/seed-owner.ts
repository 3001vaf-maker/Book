import { PrismaClient, MembershipRole } from '@prisma/client';
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
  });
}

main()
  .finally(() => prisma.$disconnect());
