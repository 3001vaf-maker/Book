-- Finalize Deposit ownership.
-- Historical FinanceOperation rows remain audit / money facts.
-- From this migration forward LoyaltyDepositInstance is mutated by the server owner,
-- not reconstructed by a database trigger from FinanceOperation.

CREATE TABLE IF NOT EXISTS "LoyaltyDepositProgram" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyDepositProgram_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyDepositProgram_tenantId_programId_key"
    ON "LoyaltyDepositProgram"("tenantId", "programId");
CREATE INDEX IF NOT EXISTS "LoyaltyDepositProgram_tenantId_createdAt_idx"
    ON "LoyaltyDepositProgram"("tenantId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'LoyaltyDepositProgram_tenantId_fkey'
    ) THEN
        ALTER TABLE "LoyaltyDepositProgram"
            ADD CONSTRAINT "LoyaltyDepositProgram_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Promote existing program definitions out of auxiliary JSON into their canonical server table.
INSERT INTO "LoyaltyDepositProgram" ("id", "tenantId", "programId", "data", "createdAt", "updatedAt")
SELECT
    a."tenantId" || ':deposit-program:' || COALESCE(p.value->>'id', ''),
    a."tenantId",
    COALESCE(p.value->>'id', ''),
    p.value,
    a."createdAt",
    CURRENT_TIMESTAMP
FROM "BusinessAuxiliaryState" a
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(a."data"->'depositPrograms') = 'array'
        THEN a."data"->'depositPrograms'
        ELSE '[]'::jsonb
    END
) p(value)
WHERE COALESCE(p.value->>'id', '') <> ''
ON CONFLICT ("tenantId", "programId") DO UPDATE SET
    "data" = EXCLUDED."data",
    "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "BusinessAuxiliaryState"
SET "data" = COALESCE("data", '{}'::jsonb) - 'depositPrograms',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE COALESCE("data", '{}'::jsonb) ? 'depositPrograms';

-- Backfill exact principal/benefit components into historical payment/refund allocations.
-- This is one-time migration work only; runtime no longer replays FinanceOperation to own Deposit state.
CREATE OR REPLACE FUNCTION backfill_deposit_allocation_components(p_tenant_id text, p_deposit_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    funding "FinanceOperation"%ROWTYPE;
    operation_row "FinanceOperation"%ROWTYPE;
    terms_value jsonb := '{}'::jsonb;
    principal numeric(14,2) := 0;
    benefit numeric(14,2) := 0;
    allocation_amount numeric(14,2) := 0;
    principal_used numeric(14,2) := 0;
    benefit_used numeric(14,2) := 0;
    refund_principal numeric(14,2) := 0;
    refund_benefit numeric(14,2) := 0;
    original_split jsonb := '{}'::jsonb;
    restored_split jsonb := '{}'::jsonb;
    payment_splits jsonb := '{}'::jsonb;
    restored_splits jsonb := '{}'::jsonb;
    next_allocations jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO funding
    FROM "FinanceOperation"
    WHERE "tenantId" = p_tenant_id
      AND "kind" = 'deposit-funding'
      AND "sourceType" = 'deposit'
      AND "sourceId" = p_deposit_id
      AND "status" = 'completed'
    ORDER BY "createdAt" ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    principal := GREATEST(0, loyalty_deposit_amount(funding."data"));
    terms_value := COALESCE(funding."data"->'terms', '{}'::jsonb);
    IF loyalty_deposit_benefit_mode(terms_value) = 'accrual' THEN
        benefit := ROUND((principal * loyalty_deposit_benefit_rate(terms_value) / 100.0)::numeric, 2);
    END IF;

    FOR operation_row IN
        SELECT *
        FROM "FinanceOperation"
        WHERE "tenantId" = p_tenant_id
          AND "status" = 'completed'
          AND "operationId" <> funding."operationId"
          AND (
              ("sourceType" = 'deposit' AND "sourceId" = p_deposit_id AND "kind" = 'deposit-withdrawal')
              OR "kind" IN ('payment', 'refund')
          )
        ORDER BY "occurredAt" ASC, "createdAt" ASC
    LOOP
        IF operation_row."kind" = 'deposit-withdrawal' THEN
            principal := GREATEST(0, principal - loyalty_deposit_amount(operation_row."data"));
            benefit := 0;
            CONTINUE;
        END IF;

        allocation_amount := GREATEST(0, loyalty_deposit_allocation(operation_row."data", p_deposit_id));
        IF allocation_amount <= 0 THEN
            CONTINUE;
        END IF;

        IF operation_row."kind" = 'payment' THEN
            principal_used := LEAST(principal, allocation_amount);
            benefit_used := LEAST(benefit, GREATEST(0, allocation_amount - principal_used));
            principal := GREATEST(0, principal - principal_used);
            benefit := GREATEST(0, benefit - benefit_used);
            payment_splits := jsonb_set(
                payment_splits,
                ARRAY[operation_row."operationId"],
                jsonb_build_object('principal', principal_used, 'benefit', benefit_used),
                true
            );

            SELECT COALESCE(jsonb_agg(
                CASE
                    WHEN COALESCE(a->>'depositId', a->>'sourceId', a->>'id', '') = p_deposit_id
                    THEN a || jsonb_build_object('principalAmount', principal_used, 'benefitAmount', benefit_used)
                    ELSE a
                END
            ), '[]'::jsonb)
            INTO next_allocations
            FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(operation_row."data"->'depositAllocations') = 'array'
                    THEN operation_row."data"->'depositAllocations'
                    WHEN jsonb_typeof(operation_row."data"->'depositAllocations') = 'object'
                    THEN jsonb_build_array(operation_row."data"->'depositAllocations')
                    ELSE '[]'::jsonb
                END
            ) a;

            UPDATE "FinanceOperation"
            SET "data" = jsonb_set(COALESCE("data", '{}'::jsonb), '{depositAllocations}', next_allocations, true),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = operation_row."id";
            CONTINUE;
        END IF;

        original_split := COALESCE(payment_splits->operation_row."originalOperationId", '{}'::jsonb);
        IF original_split = '{}'::jsonb THEN
            CONTINUE;
        END IF;
        restored_split := COALESCE(restored_splits->operation_row."originalOperationId", '{}'::jsonb);
        refund_principal := LEAST(
            allocation_amount,
            GREATEST(0, loyalty_deposit_number(original_split->>'principal') - loyalty_deposit_number(restored_split->>'principal'))
        );
        refund_benefit := LEAST(
            GREATEST(0, allocation_amount - refund_principal),
            GREATEST(0, loyalty_deposit_number(original_split->>'benefit') - loyalty_deposit_number(restored_split->>'benefit'))
        );
        principal := principal + refund_principal;
        benefit := benefit + refund_benefit;
        restored_splits := jsonb_set(
            restored_splits,
            ARRAY[operation_row."originalOperationId"],
            jsonb_build_object(
                'principal', loyalty_deposit_number(restored_split->>'principal') + refund_principal,
                'benefit', loyalty_deposit_number(restored_split->>'benefit') + refund_benefit
            ),
            true
        );

        SELECT COALESCE(jsonb_agg(
            CASE
                WHEN COALESCE(a->>'depositId', a->>'sourceId', a->>'id', '') = p_deposit_id
                THEN a || jsonb_build_object('principalAmount', refund_principal, 'benefitAmount', refund_benefit)
                ELSE a
            END
        ), '[]'::jsonb)
        INTO next_allocations
        FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(operation_row."data"->'depositAllocations') = 'array'
                THEN operation_row."data"->'depositAllocations'
                WHEN jsonb_typeof(operation_row."data"->'depositAllocations') = 'object'
                THEN jsonb_build_array(operation_row."data"->'depositAllocations')
                ELSE '[]'::jsonb
            END
        ) a;

        UPDATE "FinanceOperation"
        SET "data" = jsonb_set(COALESCE("data", '{}'::jsonb), '{depositAllocations}', next_allocations, true),
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = operation_row."id";
    END LOOP;
END;
$$;

DO $$
DECLARE
    row_record record;
BEGIN
    FOR row_record IN
        SELECT DISTINCT "tenantId", "sourceId" AS "depositId"
        FROM "FinanceOperation"
        WHERE "kind" = 'deposit-funding'
          AND "sourceType" = 'deposit'
          AND "status" = 'completed'
          AND COALESCE("sourceId", '') <> ''
    LOOP
        PERFORM loyalty_deposit_recalculate(row_record."tenantId", row_record."depositId");
        PERFORM backfill_deposit_allocation_components(row_record."tenantId", row_record."depositId");
    END LOOP;
END;
$$;

DROP FUNCTION backfill_deposit_allocation_components(text, text);
DROP TRIGGER IF EXISTS "LoyaltyDepositFinanceSync" ON "FinanceOperation";
DROP FUNCTION IF EXISTS loyalty_deposit_finance_sync();
DROP FUNCTION IF EXISTS loyalty_deposit_operation_ids("FinanceOperation");
DROP FUNCTION IF EXISTS loyalty_deposit_recalculate(text, text);
DROP FUNCTION IF EXISTS loyalty_deposit_allocation(jsonb, text);
DROP FUNCTION IF EXISTS loyalty_deposit_terms_active(jsonb, timestamp without time zone);
DROP FUNCTION IF EXISTS loyalty_deposit_benefit_rate(jsonb);
DROP FUNCTION IF EXISTS loyalty_deposit_benefit_mode(jsonb);
DROP FUNCTION IF EXISTS loyalty_deposit_number(text);
DROP FUNCTION IF EXISTS loyalty_deposit_amount(jsonb);
