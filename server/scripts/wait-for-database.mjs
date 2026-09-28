import { PrismaClient } from '@prisma/client';

const attempts = Math.max(1, Number(process.env.DATABASE_WAIT_ATTEMPTS || 60));
const delayMs = Math.max(250, Number(process.env.DATABASE_WAIT_DELAY_MS || 2000));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let ready = false;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`[database-wait] database is ready (${attempt}/${attempts})`);
    ready = true;
    await prisma.$disconnect().catch(() => {});
    break;
  } catch (error) {
    await prisma.$disconnect().catch(() => {});
    const name = String(error?.name || 'DatabaseConnectionError');
    const code = String(error?.code || '');
    console.warn(`[database-wait] database unavailable (${attempt}/${attempts}) ${name}${code ? ` ${code}` : ''}`);
    if (attempt < attempts) await sleep(delayMs);
  }
}

if (!ready) {
  console.error(`[database-wait] database did not become reachable after ${attempts} attempts`);
  process.exitCode = 2;
}
