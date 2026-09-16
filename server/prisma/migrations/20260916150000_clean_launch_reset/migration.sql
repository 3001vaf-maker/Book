-- CLEAN LAUNCH RESET
--
-- One-time data migration for the official Book launch.
-- It deliberately preserves schema/migrations, the platform owner/admin access,
-- TenantAccess for the owner, and global SaaS catalogs (Capability / Plan / PlanCapability).
-- All business/client/test data is removed. The migration is transactional: any failed
-- postcondition aborts the deployment instead of leaving a partially cleaned database.

-- Record the actual public-table row counts in migration logs before deleting anything.
DO $$
DECLARE
  row_record RECORD;
  row_count BIGINT;
BEGIN
  FOR row_record IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', row_record.table_name) INTO row_count;
    IF row_count > 0 THEN
      RAISE NOTICE 'BOOK_CLEAN_RESET BEFORE table=% rows=%', row_record.table_name, row_count;
    END IF;
  END LOOP;
END $$;

-- Resolve the one canonical platform-owner tenant/user using the current Book control-plane rules:
-- 1) explicit TenantAccess.isOwnerBook;
-- 2) an existing PlatformAdmin OWNER membership;
-- 3) the oldest Tenant OWNER membership (same bootstrap fallback as PlatformAdminGuard).
CREATE TEMP TABLE "_BookCleanResetOwner" (
  "tenantId" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE
) ON COMMIT DROP;

DO $$
DECLARE
  resolved_tenant_id TEXT;
  resolved_user_id TEXT;
  existing_tenant_count BIGINT;
BEGIN
  SELECT count(*) INTO existing_tenant_count FROM "Tenant";

  IF existing_tenant_count = 0 THEN
    RETURN;
  END IF;

  SELECT ta."tenantId", m."userId"
    INTO resolved_tenant_id, resolved_user_id
  FROM "TenantAccess" ta
  JOIN "Membership" m
    ON m."tenantId" = ta."tenantId"
   AND m."role" = 'OWNER'::"MembershipRole"
  LEFT JOIN "PlatformAdmin" pa ON pa."userId" = m."userId"
  WHERE ta."isOwnerBook" = true
  ORDER BY (pa."id" IS NOT NULL) DESC, m."createdAt" ASC, m."id" ASC
  LIMIT 1;

  IF resolved_tenant_id IS NULL THEN
    SELECT m."tenantId", m."userId"
      INTO resolved_tenant_id, resolved_user_id
    FROM "PlatformAdmin" pa
    JOIN "Membership" m
      ON m."userId" = pa."userId"
     AND m."role" = 'OWNER'::"MembershipRole"
    JOIN "Tenant" t ON t."id" = m."tenantId"
    ORDER BY t."createdAt" ASC, m."createdAt" ASC, m."id" ASC
    LIMIT 1;
  END IF;

  IF resolved_tenant_id IS NULL THEN
    SELECT t."id", m."userId"
      INTO resolved_tenant_id, resolved_user_id
    FROM "Tenant" t
    JOIN "Membership" m
      ON m."tenantId" = t."id"
     AND m."role" = 'OWNER'::"MembershipRole"
    ORDER BY t."createdAt" ASC, t."id" ASC, m."createdAt" ASC, m."id" ASC
    LIMIT 1;
  END IF;

  IF resolved_tenant_id IS NULL OR resolved_user_id IS NULL THEN
    RAISE EXCEPTION 'BOOK_CLEAN_RESET refused: production contains Tenant rows but no canonical OWNER membership';
  END IF;

  INSERT INTO "_BookCleanResetOwner" ("tenantId", "userId")
  VALUES (resolved_tenant_id, resolved_user_id);

  RAISE NOTICE 'BOOK_CLEAN_RESET preserving owner tenant=% user=%', resolved_tenant_id, resolved_user_id;
END $$;

-- Invalidate every previously issued master-registration token before deleting invitation-only tenants.
DELETE FROM "MasterInvitation";

-- Queues / notifications / external identities and bindings.
DELETE FROM "NotificationReminderDelivery";
DELETE FROM "NotificationDelivery";
DELETE FROM "WebPushSubscription";
DELETE FROM "Notification";
DELETE FROM "NotificationReminderRule";
DELETE FROM "NotificationTemplateOverride";
DELETE FROM "NotificationRoutingPolicy";
DELETE FROM "CommunicationGroupMember";
DELETE FROM "CommunicationGroup";
DELETE FROM "CommunicationMessage";
DELETE FROM "CommunicationIdentity";
DELETE FROM "CommunicationPreference";
DELETE FROM "CommunicationBroadcastRun";
DELETE FROM "CommunicationTemplate";
DELETE FROM "TelegramEntryTicket";
DELETE FROM "TelegramBotConnection";

-- Canonical append-only consent history is user/business data for the test tenants.
DELETE FROM "ConsentEvent";

-- Public online booking: publication first becomes empty; accounts/requests are removed as well.
DELETE FROM "BookingRequest";
DELETE FROM "BookingAccount";
DELETE FROM "BookingPublication";

-- Business/domain state (clients/Person, records/events, procedures, finance, wallets,
-- documents state, tags/products/other auxiliary state all live inside these server owners).
DELETE FROM "BusinessRecordEvent";
DELETE FROM "BusinessRecord";
DELETE FROM "BusinessPerson";
DELETE FROM "BusinessIdentityState";
DELETE FROM "BusinessOperationalState";
DELETE FROM "BusinessDocumentState";
DELETE FROM "BusinessAuxiliaryState";
DELETE FROM "BusinessStateMeta";

-- Product/workspace data for every test user, including the platform owner's old test workspace.
DELETE FROM "Workplace";
DELETE FROM "Profile";
DELETE FROM "WorkspaceState";

-- Remove every non-owner Tenant. Cascades clear its Membership/TenantAccess/capability overrides,
-- time zone and any tenant-scoped rows that are protected by foreign keys.
DELETE FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1
  FROM "_BookCleanResetOwner" owner_row
  WHERE owner_row."tenantId" = t."id"
);

-- Remove test Users that survived Tenant deletion. Keep exactly the canonical owner user.
DELETE FROM "User" u
WHERE NOT EXISTS (
  SELECT 1
  FROM "_BookCleanResetOwner" owner_row
  WHERE owner_row."userId" = u."id"
);

-- Reassert the preserved account as the platform owner without changing its password or IDs.
INSERT INTO "TenantAccess" (
  "tenantId", "planId", "status", "isOwnerBook", "createdAt", "updatedAt"
)
SELECT owner_row."tenantId", NULL, 'ACTIVE'::"TenantAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "_BookCleanResetOwner" owner_row
ON CONFLICT ("tenantId") DO UPDATE SET
  "isOwnerBook" = true,
  "status" = 'ACTIVE'::"TenantAccessStatus",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlatformAdmin" ("id", "userId", "createdAt", "updatedAt")
SELECT 'pa_clean_' || md5(owner_row."userId"), owner_row."userId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "_BookCleanResetOwner" owner_row
ON CONFLICT ("userId") DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP;

-- Strong postconditions. Any mismatch rolls the whole migration back.
DO $$
DECLARE
  expected_owner_count BIGINT;
  actual_count BIGINT;
  row_record RECORD;
BEGIN
  SELECT count(*) INTO expected_owner_count FROM "_BookCleanResetOwner";

  SELECT count(*) INTO actual_count FROM "Tenant";
  IF actual_count <> expected_owner_count THEN
    RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: Tenant count %, expected %', actual_count, expected_owner_count;
  END IF;

  SELECT count(*) INTO actual_count FROM "User";
  IF actual_count <> expected_owner_count THEN
    RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: User count %, expected %', actual_count, expected_owner_count;
  END IF;

  SELECT count(*) INTO actual_count FROM "Membership";
  IF actual_count <> expected_owner_count THEN
    RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: Membership count %, expected %', actual_count, expected_owner_count;
  END IF;

  SELECT count(*) INTO actual_count FROM "PlatformAdmin";
  IF actual_count <> expected_owner_count THEN
    RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: PlatformAdmin count %, expected %', actual_count, expected_owner_count;
  END IF;

  SELECT count(*) INTO actual_count FROM "BookingAccount";
  IF actual_count <> 0 THEN RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: BookingAccount=%', actual_count; END IF;

  SELECT count(*) INTO actual_count FROM "BookingRequest";
  IF actual_count <> 0 THEN RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: BookingRequest=%', actual_count; END IF;

  SELECT count(*) INTO actual_count FROM "BookingPublication";
  IF actual_count <> 0 THEN RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: BookingPublication=%', actual_count; END IF;

  SELECT count(*) INTO actual_count FROM "ConsentEvent";
  IF actual_count <> 0 THEN RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: ConsentEvent=%', actual_count; END IF;

  SELECT count(*) INTO actual_count FROM "MasterInvitation";
  IF actual_count <> 0 THEN RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: MasterInvitation=%', actual_count; END IF;

  SELECT count(*) INTO actual_count FROM "CommunicationMessage"
  WHERE upper("channel") NOT IN ('IN_APP', 'OWNER_IN_APP')
    AND lower("status") IN ('created', 'queued', 'pending', 'sending');
  IF actual_count <> 0 THEN RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: pending external CommunicationMessage=%', actual_count; END IF;

  SELECT count(*) INTO actual_count FROM "NotificationDelivery"
  WHERE lower("status") IN ('created', 'queued', 'pending', 'sending');
  IF actual_count <> 0 THEN RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: pending NotificationDelivery=%', actual_count; END IF;

  -- Global SaaS catalogs must survive the cleanup.
  SELECT count(*) INTO actual_count FROM "Capability";
  IF actual_count < 14 THEN RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: Capability catalog was damaged (%)', actual_count; END IF;

  SELECT count(*) INTO actual_count FROM "Plan";
  IF actual_count < 1 THEN RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: Plan catalog was damaged'; END IF;

  SELECT count(*) INTO actual_count FROM "PlanCapability";
  IF actual_count < 14 THEN RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: PlanCapability catalog was damaged (%)', actual_count; END IF;

  -- Every current tenant-scoped table that is business/user data must now be empty.
  -- The listed exceptions are deliberate owner/control-plane state that must survive.
  FOR row_record IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenantId'
      AND table_name NOT IN (
        'Membership',
        'TenantAccess',
        'TenantCapabilityOverride',
        'CapabilityAccessEvent',
        'TenantTimeZone'
      )
    ORDER BY table_name
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', row_record.table_name) INTO actual_count;
    IF actual_count <> 0 THEN
      RAISE EXCEPTION 'BOOK_CLEAN_RESET failed: tenant-scoped table % still contains % rows', row_record.table_name, actual_count;
    END IF;
  END LOOP;

  RAISE NOTICE 'BOOK_CLEAN_RESET AFTER Tenant=% User=% BookingAccount=0 BookingRequest=0 ConsentEvent=0 pendingInvitations=0 pendingExternalMessages=0',
    expected_owner_count, expected_owner_count;
END $$;
