import { PrismaClient } from '@prisma/client';

const attempts = Math.max(1, Number(process.env.DATABASE_WAIT_ATTEMPTS || 60));
const delayMs = Math.max(250, Number(process.env.DATABASE_WAIT_DELAY_MS || 2000));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeErrorMessage = (value) => {
  let text = String(value || '');
  const databaseUrl = String(process.env.DATABASE_URL || '');

  if (databaseUrl) {
    text = text.split(databaseUrl).join('[DATABASE_URL]');
    try {
      const parsed = new URL(databaseUrl);
      const rawPassword = parsed.password || '';
      const decodedPassword = rawPassword ? decodeURIComponent(rawPassword) : '';
      if (rawPassword) text = text.split(rawPassword).join('[REDACTED]');
      if (decodedPassword) text = text.split(decodedPassword).join('[REDACTED]');
    } catch {
      // Ignore malformed URL here; Prisma will report the real connection error below.
    }
  }

  return text
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
};

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
    const message = sanitizeErrorMessage(error?.message);
    console.warn(
      `[database-wait] database unavailable (${attempt}/${attempts}) ${name}${code ? ` ${code}` : ''}${message ? `: ${message}` : ''}`,
    );
    if (attempt < attempts) await sleep(delayMs);
  }
}

if (!ready) {
  console.error(`[database-wait] database did not become reachable after ${attempts} attempts`);
  process.exitCode = 2;
}
