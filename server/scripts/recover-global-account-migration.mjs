import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const migration = '20260921130000_global_account_identity';

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT "id", "migration_name", "logs", "finished_at", "rolled_back_at", "started_at"
    FROM "_prisma_migrations"
    WHERE "migration_name" = '${migration}'
    ORDER BY "started_at" DESC
  `);

  const failed = rows.find((row) => row.finished_at == null && row.rolled_back_at == null);
  if (!failed) {
    console.log('[migration-recovery] no active failed global-account migration');
    return 0;
  }

  console.error('[migration-recovery] detected failed migration:', migration);
  if (failed.logs) {
    console.error('[migration-recovery] original Prisma error follows:');
    console.error(String(failed.logs).slice(0, 12000));
  }

  const stateRows = await prisma.$queryRawUnsafe(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Account' AND column_name = 'tenantId'
      ) AS "hasTenantId",
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Account' AND column_name = 'createdViaTenantId'
      ) AS "hasCreatedViaTenantId",
      to_regclass('"AccountContact"') IS NOT NULL AS "hasAccountContact",
      to_regclass('"AccountContactConflict"') IS NOT NULL AS "hasAccountContactConflict",
      EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'AccountContactType'
      ) AS "hasAccountContactType"
  `);

  const state = stateRows[0] || {};
  const fullyRolledBack =
    state.hasTenantId === true
    && state.hasCreatedViaTenantId === false
    && state.hasAccountContact === false
    && state.hasAccountContactConflict === false
    && state.hasAccountContactType === false;

  if (!fullyRolledBack) {
    console.error('[migration-recovery] database is not in the expected fully rolled-back pre-migration state');
    console.error('[migration-recovery] refusing automatic resolve; manual inspection is required');
    return 2;
  }

  const duplicateRows = await prisma.$queryRawUnsafe(`
    WITH contacts AS (
      SELECT "id" AS "accountId", 'EMAIL' AS "type", lower(trim("email")) AS "value"
      FROM "Account"
      WHERE trim("email") <> ''

      UNION ALL

      SELECT
        "id",
        'PHONE',
        CASE
          WHEN length(regexp_replace("phone", '[^0-9]', '', 'g')) = 10
            THEN '7' || regexp_replace("phone", '[^0-9]', '', 'g')
          WHEN length(regexp_replace("phone", '[^0-9]', '', 'g')) = 11
            AND regexp_replace("phone", '[^0-9]', '', 'g') LIKE '8%'
            THEN '7' || substring(regexp_replace("phone", '[^0-9]', '', 'g') from 2)
          ELSE regexp_replace("phone", '[^0-9]', '', 'g')
        END
      FROM "Account"
      WHERE regexp_replace("phone", '[^0-9]', '', 'g') <> ''

      UNION ALL

      SELECT "id", 'TELEGRAM', trim("telegramId")
      FROM "Account"
      WHERE trim("telegramId") <> ''
    )
    SELECT count(*)::int AS "conflictCount"
    FROM (
      SELECT "type", "value"
      FROM contacts
      GROUP BY "type", "value"
      HAVING count(DISTINCT "accountId") > 1
    ) conflicts
  `);

  console.warn(
    '[migration-recovery] legacy contact conflicts to quarantine:',
    Number(duplicateRows[0]?.conflictCount || 0),
  );
  console.warn('[migration-recovery] migration may be safely marked rolled back and retried');
  return 42;
}

let exitCode = 2;
try {
  exitCode = await main();
} catch (error) {
  console.error('[migration-recovery] recovery preflight failed:', error);
  exitCode = 2;
} finally {
  await prisma.$disconnect().catch(() => {});
}

process.exitCode = exitCode;
