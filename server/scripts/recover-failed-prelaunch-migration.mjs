import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const migration = '20260922075500_prelaunch_hard_delete_clean_start';

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

async function triggerExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = $1
        AND NOT tgisinternal
    ) AS "exists"`,
    name,
  );
  return rows[0]?.exists === true;
}

async function constraintExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = $1
    ) AS "exists"`,
    name,
  );
  return rows[0]?.exists === true;
}

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       "id",
       "migration_name",
       "logs",
       "finished_at",
       "rolled_back_at",
       "started_at",
       "applied_steps_count"
     FROM "_prisma_migrations"
     WHERE "migration_name" = $1
     ORDER BY "started_at" DESC`,
    migration,
  );

  const failed = rows.find((row) => row.finished_at == null && row.rolled_back_at == null);
  if (!failed) {
    console.log('[prelaunch-recovery] no active failed 07:55 migration');
    return 0;
  }

  if (!String(failed.logs || '').trim()) {
    console.error('[prelaunch-recovery] failed 07:55 row has no stored error log; refusing automatic recovery');
    return 2;
  }

  const state = {
    liveRequestedAt: await columnExists('TenantAccess', 'liveRequestedAt'),
    liveRequestedByPlatformAccountId: await columnExists('TenantAccess', 'liveRequestedByPlatformAccountId'),
    liveApprovedAt: await columnExists('TenantAccess', 'liveApprovedAt'),
    liveApprovedByAdminId: await columnExists('TenantAccess', 'liveApprovedByAdminId'),
    platformConsentTrigger: await triggerExists('PlatformConsentEvent_append_only'),
    platformActivityTrigger: await triggerExists('PlatformActivityEvent_append_only'),
    platformConsentTenantFk: await constraintExists('PlatformConsentEvent_tenantId_fkey'),
    platformConsentAccountFk: await constraintExists('PlatformConsentEvent_platformAccountId_fkey'),
    workspaceTenantFk: await constraintExists('WorkspaceState_tenantId_fkey'),
    workspaceAccountFk: await constraintExists('WorkspaceState_platformAccountId_fkey'),
  };

  const expectedFullyRolledBack =
    !state.liveRequestedAt
    && !state.liveRequestedByPlatformAccountId
    && !state.liveApprovedAt
    && !state.liveApprovedByAdminId
    && state.platformConsentTrigger
    && state.platformActivityTrigger
    && !state.platformConsentTenantFk
    && !state.platformConsentAccountFk
    && !state.workspaceTenantFk
    && !state.workspaceAccountFk;

  if (!expectedFullyRolledBack) {
    console.error('[prelaunch-recovery] database is not in the expected pre-07:55 state');
    console.error('[prelaunch-recovery] refusing automatic resolve:', JSON.stringify(state));
    return 2;
  }

  console.warn('[prelaunch-recovery] failed 07:55 is fully rolled back and may be safely retried');
  return 42;
}

let status = 2;
try {
  status = await main();
} catch (error) {
  console.error('[prelaunch-recovery] verification failed:', error);
  status = 2;
} finally {
  await prisma.$disconnect().catch(() => {});
}

process.exitCode = status;
