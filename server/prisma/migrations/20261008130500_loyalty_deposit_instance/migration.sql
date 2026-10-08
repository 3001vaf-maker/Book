-- DepositInstance becomes a persisted Loyalty entity.
-- FinanceOperation remains the owner of money / settlement facts and references depositId.
-- The trigger below is the atomic connection between those facts and the persisted Deposit state.

CREATE TABLE "LoyaltyDepositInstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "programId" TEXT NOT NULL DEFAULT '',
    "programName" TEXT NOT NULL DEFAULT '',
    "personKey" TEXT NOT NULL,
    "person" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "terms" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "initialAmount" DECIMAL(14,2) NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "fundedAt" TIMESTAMP(3) NOT NULL,
    "fundingOperationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyDepositInstance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyDepositInstance_tenantId_depositId_key"
    ON "LoyaltyDepositInstance"("tenantId", "depositId");
CREATE INDEX "LoyaltyDepositInstance_tenantId_personKey_status_idx"
    ON "LoyaltyDepositInstance"("tenantId", "personKey", "status");
CREATE INDEX "LoyaltyDepositInstance_tenantId_programId_idx"
    ON "LoyaltyDepositInstance"("tenantId", "programId");

ALTER TABLE "LoyaltyDepositInstance"
    ADD CONSTRAINT "LoyaltyDepositInstance_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION loyalty_deposit_amount(value jsonb)
RETURNS numeric
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE
        WHEN COALESCE(value->>'amount', value->>'total', '') ~ '^-?[0-9]+([.,][0-9]+)?$'
            THEN REPLACE(COALESCE(value->>'amount', value->>'total'), ',', '.')::numeric
        ELSE 0::numeric
    END;
$$;

CREATE OR REPLACE FUNCTION loyalty_deposit_recalculate(p_tenant_id text, p_deposit_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    funding "FinanceOperation"%ROWTYPE;
    next_balance numeric(14,2) := 0;
    funding_amount numeric(14,2) := 0;
    withdrawal_amount numeric(14,2) := 0;
    payment_amount numeric(14,2) := 0;
    refund_amount numeric(14,2) := 0;
    owner_key text := '';
BEGIN
    IF COALESCE(p_tenant_id, '') = '' OR COALESCE(p_deposit_id, '') = '' THEN
        RETURN;
    END IF;

    SELECT * INTO funding
    FROM "FinanceOperation"
    WHERE "tenantId" = p_tenant_id
      AND "kind" = 'deposit-funding'
      AND "sourceType" = 'deposit'
      AND "sourceId" = p_deposit_id
    ORDER BY "createdAt" ASC
    LIMIT 1;

    IF NOT FOUND THEN
        UPDATE "LoyaltyDepositInstance"
        SET "balance" = 0,
            "status" = 'cancelled',
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "tenantId" = p_tenant_id AND "depositId" = p_deposit_id;
        RETURN;
    END IF;

    funding_amount := loyalty_deposit_amount(funding."data");
    owner_key := COALESCE(
        funding."data"->'person'->>'key',
        funding."data"->'person'->>'personKey',
        funding."data"->'person'->>'id',
        ''
    );

    SELECT COALESCE(SUM(loyalty_deposit_amount(o."data")), 0)
    INTO withdrawal_amount
    FROM "FinanceOperation" o
    WHERE o."tenantId" = p_tenant_id
      AND o."status" = 'completed'
      AND o."kind" = 'deposit-withdrawal'
      AND o."sourceType" = 'deposit'
      AND o."sourceId" = p_deposit_id;

    SELECT COALESCE(SUM(
        CASE
            WHEN COALESCE(a->>'amount', '') ~ '^[0-9]+([.,][0-9]+)?$'
                THEN REPLACE(a->>'amount', ',', '.')::numeric
            ELSE 0::numeric
        END
    ), 0)
    INTO payment_amount
    FROM "FinanceOperation" o
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o."data"->'depositAllocations', '[]'::jsonb)) a
    WHERE o."tenantId" = p_tenant_id
      AND o."status" = 'completed'
      AND o."kind" = 'payment'
      AND COALESCE(a->>'depositId', a->>'sourceId', a->>'id', '') = p_deposit_id;

    SELECT COALESCE(SUM(
        CASE
            WHEN COALESCE(a->>'amount', '') ~ '^[0-9]+([.,][0-9]+)?$'
                THEN REPLACE(a->>'amount', ',', '.')::numeric
            ELSE 0::numeric
        END
    ), 0)
    INTO refund_amount
    FROM "FinanceOperation" o
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o."data"->'depositAllocations', '[]'::jsonb)) a
    WHERE o."tenantId" = p_tenant_id
      AND o."status" = 'completed'
      AND o."kind" = 'refund'
      AND COALESCE(a->>'depositId', a->>'sourceId', a->>'id', '') = p_deposit_id;

    IF funding."status" = 'completed' THEN
        next_balance := GREATEST(0, funding_amount - withdrawal_amount - payment_amount + refund_amount);
    ELSE
        next_balance := 0;
    END IF;

    INSERT INTO "LoyaltyDepositInstance" (
        "id", "tenantId", "depositId", "programId", "programName", "personKey", "person", "terms",
        "initialAmount", "balance", "status", "fundedAt", "fundingOperationId", "createdAt", "updatedAt"
    ) VALUES (
        p_deposit_id,
        p_tenant_id,
        p_deposit_id,
        COALESCE(funding."data"->>'programId', ''),
        COALESCE(funding."data"->>'programName', 'Депозит'),
        owner_key,
        COALESCE(funding."data"->'person', '{}'::jsonb),
        COALESCE(funding."data"->'terms', '{}'::jsonb),
        funding_amount,
        next_balance,
        CASE
            WHEN funding."status" <> 'completed' THEN 'cancelled'
            WHEN next_balance > 0.009 THEN 'active'
            ELSE 'closed'
        END,
        funding."occurredAt",
        funding."operationId",
        funding."createdAt",
        CURRENT_TIMESTAMP
    )
    ON CONFLICT ("tenantId", "depositId") DO UPDATE SET
        "programId" = EXCLUDED."programId",
        "programName" = EXCLUDED."programName",
        "personKey" = EXCLUDED."personKey",
        "person" = EXCLUDED."person",
        "terms" = EXCLUDED."terms",
        "initialAmount" = EXCLUDED."initialAmount",
        "balance" = EXCLUDED."balance",
        "status" = EXCLUDED."status",
        "fundedAt" = EXCLUDED."fundedAt",
        "fundingOperationId" = EXCLUDED."fundingOperationId",
        "updatedAt" = CURRENT_TIMESTAMP;
END;
$$;

CREATE OR REPLACE FUNCTION loyalty_deposit_operation_ids(operation_row "FinanceOperation")
RETURNS text[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    result text[] := ARRAY[]::text[];
    allocation jsonb;
    allocation_id text;
BEGIN
    IF operation_row."sourceType" = 'deposit'
       AND operation_row."kind" IN ('deposit-funding', 'deposit-withdrawal')
       AND COALESCE(operation_row."sourceId", '') <> '' THEN
        result := array_append(result, operation_row."sourceId");
    END IF;

    IF operation_row."kind" IN ('payment', 'refund') THEN
        FOR allocation IN
            SELECT value FROM jsonb_array_elements(COALESCE(operation_row."data"->'depositAllocations', '[]'::jsonb))
        LOOP
            allocation_id := COALESCE(allocation->>'depositId', allocation->>'sourceId', allocation->>'id', '');
            IF allocation_id <> '' AND NOT (allocation_id = ANY(result)) THEN
                result := array_append(result, allocation_id);
            END IF;
        END LOOP;
    END IF;

    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION loyalty_deposit_finance_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    affected text[] := ARRAY[]::text[];
    deposit_id text;
    candidate text;
    tenant_id text;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        FOREACH candidate IN ARRAY loyalty_deposit_operation_ids(OLD)
        LOOP
            IF candidate <> '' AND NOT (candidate = ANY(affected)) THEN
                affected := array_append(affected, candidate);
            END IF;
        END LOOP;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        FOREACH candidate IN ARRAY loyalty_deposit_operation_ids(NEW)
        LOOP
            IF candidate <> '' AND NOT (candidate = ANY(affected)) THEN
                affected := array_append(affected, candidate);
            END IF;
        END LOOP;
    END IF;

    tenant_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."tenantId" ELSE NEW."tenantId" END;

    FOREACH deposit_id IN ARRAY affected
    LOOP
        PERFORM loyalty_deposit_recalculate(tenant_id, deposit_id);
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "LoyaltyDepositFinanceSync"
AFTER INSERT OR UPDATE OR DELETE ON "FinanceOperation"
FOR EACH ROW EXECUTE FUNCTION loyalty_deposit_finance_sync();

-- Backfill every Deposit that existed before the standalone entity table.
DO $$
DECLARE
    row_record record;
BEGIN
    FOR row_record IN
        SELECT DISTINCT "tenantId", "sourceId" AS "depositId"
        FROM "FinanceOperation"
        WHERE "kind" = 'deposit-funding'
          AND "sourceType" = 'deposit'
          AND COALESCE("sourceId", '') <> ''
    LOOP
        PERFORM loyalty_deposit_recalculate(row_record."tenantId", row_record."depositId");
    END LOOP;
END;
$$;
