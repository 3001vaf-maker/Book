import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = String(process.env.OWNER_EMAIL || 'staging@book.local').trim().toLowerCase();
  const owner = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true },
  });
  const tenantId = owner?.memberships?.[0]?.tenantId;
  if (!tenantId) throw new Error('Run seed:owner before seed-staging-publication');

  await prisma.bookingPublication.upsert({
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

  console.log('Synthetic staging online-booking publication is active.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
