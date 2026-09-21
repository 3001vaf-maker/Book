import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const migration = '20260921130000_global_account_identity';

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT to_regclass($1) IS NOT NULL AS "exists"',
    '"' + name + '"',
  );
  return rows[0]?.exists === true;
}

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS "exists"`,
    table,
    column,
  );
  return rows[0]?.exists === true;
}

async function countRows(table) {
  if (!(await tableExists(table))) return 0;
  const rows = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS "count" FROM "${table}"`);
  return Number(rows[0]?.count || 0);
}

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id", "migration_name", "logs", "finished_at", "rolled_back_at", "started_at"
     FROM "_prisma_migrations"
     WHERE "migration_name" = $1
     ORDER BY "started_at" DESC`,
    migration,
  );

  const failed = rows.find((row) => row.finished_at == null && row.rolled_back_at == null);
  if (!failed) {
    console.log('[account-reset] no active failed global Account migration');
    return 0;
  }

  const oldTenantColumn = await columnExists('Account', 'tenantId');
  const newTenantColumn = await columnExists('Account', 'createdViaTenantId');
  const accountContactExists = await tableExists('AccountContact');
  const accountContactTypeRows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountContactType') AS "exists"`,
  );
  const accountContactTypeExists = accountContactTypeRows[0]?.exists === true;

  const fullyRolledBack =
    oldTenantColumn
    && !newTenantColumn
    && !accountContactExists
    && !accountContactTypeExists;

  if (!fullyRolledBack) {
    console.error('[account-reset] failed migration is not in the expected fully rolled-back state');
    console.error('[account-reset] refusing automatic cleanup');
    return 2;
  }

  const before = {
    accounts: await countRows('Account'),
    bookingRequests: await countRows('BookingRequest'),
    webPushSubscriptions: await countRows('WebPushSubscription'),
    telegramEntryTickets: await countRows('TelegramEntryTicket'),
  };
  console.warn('[account-reset] removing test end-person contour:', JSON.stringify(before));

  await prisma.$transaction(async (tx) => {
    if (await tableExists('TenantConsentEvent')) {
      await tx.$executeRawUnsafe(
        `DELETE FROM "TenantConsentEvent"
         WHERE "subjectType" IN ('ACCOUNT', 'BOOKING_ACCOUNT', 'CONTACT_POINT')`,
      );
    }

    if (await tableExists('Person')) {
      await tx.$executeRawUnsafe(
        `UPDATE "Person"
         SET "data" = jsonb_set(COALESCE("data", '{}'::jsonb), '{accounts}', '[]'::jsonb, true)
         WHERE jsonb_typeof(COALESCE("data"->'accounts', '[]'::jsonb)) = 'array'
           AND jsonb_array_length(COALESCE("data"->'accounts', '[]'::jsonb)) > 0`,
      );
    }

    if (await tableExists('TelegramEntryTicket')) {
      await tx.$executeRawUnsafe('DELETE FROM "TelegramEntryTicket"');
    }

    if (await tableExists('WebPushSubscription')) {
      await tx.$executeRawUnsafe('DELETE FROM "WebPushSubscription"');
    }

    if (await tableExists('BookingRequest')) {
      await tx.$executeRawUnsafe('DELETE FROM "BookingRequest"');
    }

    if (await tableExists('Account')) {
      await tx.$executeRawUnsafe('DELETE FROM "Account"');
    }
  });

  const after = {
    accounts: await countRows('Account'),
    bookingRequests: await countRows('BookingRequest'),
    webPushSubscriptions: await countRows('WebPushSubscription'),
    telegramEntryTickets: await countRows('TelegramEntryTicket'),
  };

  if (Object.values(after).some((value) => value !== 0)) {
    console.error('[account-reset] test end-person contour was not fully cleared:', JSON.stringify(after));
    return 2;
  }

  const linkedPersonRows = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS "count"
     FROM "Person"
     WHERE jsonb_typeof(COALESCE("data"->'accounts', '[]'::jsonb)) = 'array'
       AND jsonb_array_length(COALESCE("data"->'accounts', '[]'::jsonb)) > 0`,
  );
  if (Number(linkedPersonRows[0]?.count || 0) !== 0) {
    console.error('[account-reset] Person still contains stale Account links');
    return 2;
  }

  console.warn('[account-reset] test Account values cleared; global Account migration may be retried');
  return 42;
}

let status = 2;
try {
  status = await main();
} catch (error) {
  console.error('[account-reset] recovery failed:', error);
  status = 2;
} finally {
  await prisma.$disconnect().catch(() => {});
}

process.exitCode = status;
