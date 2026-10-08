-- Deposit keeps real principal separate from promotional value.
-- benefitType=discount is a time-limited discount right and never creates money in the Deposit balance.
-- benefitType=accrual adds promotional spendable value once, at funding time.

ALTER TABLE "LoyaltyDepositInstance"
    ADD COLUMN IF NOT EXISTS "principalBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "benefitBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "LoyaltyDepositInstance"
SET "principalBalance" = GREATEST(0, "balance"),
    "benefitBalance" = 0
WHERE "principalBalance" = 0 AND "benefitBalance" = 0;

CREATE OR REPLACE FUNCTION loyalty_deposit_number(value text)
RETURNS numeric
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE
        WHEN COALESCE(value, '') ~ '^-?[0-9]+([.,][0-9]+)?$'
            THEN REPLACE(value, ',', '.')::numeric
        ELSE 0::numeric
    END;
$$;

CREATE OR REPLACE FUNCTION loyalty_deposit_benefit_mode(terms jsonb)
RETURNS text
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT CASE LOWER(COALESCE(terms->>'benefitType', 'none'))
        WHEN 'accrual' THEN 'accrual'
        WHEN 'discount' THEN 'discount'
        ELSE 'none'
    END;
$$;

CREATE OR REPLACE FUNCTION loyalty_deposit_benefit_rate(terms jsonb)
RETURNS numeric
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT GREATEST(0::numeric, LEAST(100::numeric, loyalty_deposit_number(terms->>'benefitValue')));
$$;

CREATE OR REPLACE FUNCTION loyalty_deposit_terms_active(terms jsonb, at_time timestamp)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    mode text := LOWER(COALESCE(terms->>'termMode', 'indefinite'));
    start_text text := COALESCE(terms->>'termStartDate', '');
    end_text text := COALESCE(terms->>'termEndDate', '');
BEGIN
    IF mode <> 'dated' THEN
        RETURN TRUE;
    END IF;
    IF start_text ~ '^\d{4}-\d{2}-\d{2}$' AND at_time::date < start_text::date THEN
        RETURN FALSE;
    END IF;
    IF end_text !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RETURN FALSE;
    END IF;
    RETURN at_time::date <= end_text::date;
END;
$$;

CREATE OR REPLACE FUNCTION loyalty_deposit_allocation(value jsonb, p_deposit_id text)
RETURNS numeric
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT COALESCE(SUM(
        CASE
            WHEN COALESCE(a->>'amount', '') ~ '^[0-9]+([.,][0-9]+)?$'
                THEN REPLACE(a->>'amount', ',', '.')::numeric
            ELSE 0::numeric
        END
    ), 0::numeric)
    FROM jsonb_array_elements(COALESCE(value->'depositAllocations', '[]'::jsonb)) a
    WHERE COALESCE(a->>'depositId', a->>'sourceId', a->>'id', '') = p_deposit_id;
$$;

CREATE OR REPLACE FUNCTION loyalty_deposit_recalculate(p_tenant_id text, p_deposit_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    funding "FinanceOperation"%ROWTYPE;
    operation_row "FinanceOperation"%ROWTYPE;
    terms_value jsonb := '{}'::jsonb;
    funding_amount numeric(14,2) := 0;
    principal numeric(14,2) := 0;
    benefit numeric(14,2) := 0;
    allocation_amount numeric(14,2) := 0;
    principal_used numeric(14,2) := 0;
    benefit_used numeric(14,2) := 0;
    refund_amount numeric(14,2) := 0;
    refund_principal numeric(14,2) := 0;
    refund_benefit numeric(14,2) := 0;
    original_split jsonb := '{}'::jsonb;
    restored_split jsonb := '{}'::jsonb;
    payment_splits jsonb := '{}'::jsonb;
    restored_splits jsonb := '{}'::jsonb;
    status_value text := 'active';
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
      AND "status" = 'completed'
    ORDER BY "createdAt" ASC
    LIMIT 1;

    IF NOT FOUND THEN
        DELETE FROM "LoyaltyDepositInstance"
        WHERE "tenantId" = p_tenant_id AND "depositId" = p_deposit_id;
        RETURN;
    END IF;

    funding_amount := GREATEST(0, loyalty_deposit_amount(funding."data"));
    principal := funding_amount;
    terms_value := COALESCE(funding."data"->'terms', '{}'::jsonb);

    IF loyalty_deposit_benefit_mode(terms_value) = 'accrual' THEN
        benefit := ROUND((funding_amount * loyalty_deposit_benefit_rate(terms_value) / 100.0)::numeric, 2);
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
            -- A real refund closes the instance. Promotional value cannot survive a cash refund.
            principal := GREATEST(0, principal - loyalty_deposit_amount(operation_row."data"));
            benefit := 0;
            status_value := 'closed';
            CONTINUE;
        END IF;

        IF operation_row."kind" = 'payment' THEN
            allocation_amount := GREATEST(0, loyalty_deposit_allocation(operation_row."data", p_deposit_id));
            IF allocation_amount <= 0 THEN
                CONTINUE;
            END IF;

            -- Confirmed order: real money is spent first, promotional value second.
            principal_used := LEAST(principal, allocation_amount);
            principal := GREATEST(0, principal - principal_used);
            benefit_used := LEAST(benefit, GREATEST(0, allocation_amount - principal_used));
            benefit := GREATEST(0, benefit - benefit_used);

            payment_splits := jsonb_set(
                payment_splits,
                ARRAY[operation_row."operationId"],
                jsonb_build_object('principal', principal_used, 'benefit', benefit_used),
                true
            );
            CONTINUE;
        END IF;

        IF operation_row."kind" = 'refund' THEN
            refund_amount := GREATEST(0, loyalty_deposit_allocation(operation_row."data", p_deposit_id));
            IF refund_amount <= 0 THEN
                CONTINUE;
            END IF;

            original_split := COALESCE(payment_splits->operation_row."originalOperationId", '{}'::jsonb);
            IF original_split = '{}'::jsonb THEN
                CONTINUE;
            END IF;
            restored_split := COALESCE(restored_splits->operation_row."originalOperationId", '{}'::jsonb);

            refund_principal := LEAST(
                refund_amount,
                GREATEST(0, loyalty_deposit_number(original_split->>'principal') - loyalty_deposit_number(restored_split->>'principal'))
            );
            refund_benefit := LEAST(
                GREATEST(0, refund_amount - refund_principal),
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
        END IF;
    END LOOP;

    IF status_value = 'active' AND NOT loyalty_deposit_terms_active(terms_value, CURRENT_TIMESTAMP) THEN
        principal := 0;
        benefit := 0;
        status_value := 'expired';
    ELSIF status_value = 'active' AND principal + benefit <= 0.009
          AND loyalty_deposit_benefit_mode(terms_value) <> 'discount' THEN
        status_value := 'closed';
    END IF;

    INSERT INTO "LoyaltyDepositInstance" (
        "id", "tenantId", "depositId", "programId", "programName", "personKey", "person", "terms",
        "initialAmount", "principalBalance", "benefitBalance", "balance", "status",
        "fundedAt", "fundingOperationId", "createdAt", "updatedAt"
    ) VALUES (
        p_deposit_id,
        p_tenant_id,
        p_deposit_id,
        COALESCE(funding."data"->>'programId', ''),
        COALESCE(funding."data"->>'programName', 'Депозит'),
        COALESCE(funding."data"->'person'->>'key', funding."data"->'person'->>'personKey', funding."data"->'person'->>'id', ''),
        COALESCE(funding."data"->'person', '{}'::jsonb),
        terms_value,
        funding_amount,
        principal,
        benefit,
        GREATEST(0, principal + benefit),
        status_value,
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
        "principalBalance" = EXCLUDED."principalBalance",
        "benefitBalance" = EXCLUDED."benefitBalance",
        "balance" = EXCLUDED."balance",
        "status" = EXCLUDED."status",
        "fundedAt" = EXCLUDED."fundedAt",
        "fundingOperationId" = EXCLUDED."fundingOperationId",
        "updatedAt" = CURRENT_TIMESTAMP;
END;
$$;

-- Existing trigger from the previous migration calls loyalty_deposit_recalculate for
-- funding/withdrawal/payment/refund INSERT/UPDATE/DELETE, so replacing the function is enough.

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
    END LOOP;
END;
$$;