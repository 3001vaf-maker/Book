-- Canonical Deposit business state: real principal is always separated from non-cash benefit.
-- FinanceOperation remains the owner of cash/payment facts. This migration derives Deposit state from those facts.

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
        WHEN 'accrual' THEN 'upfront'
        WHEN 'upfront' THEN 'upfront'
        WHEN 'discount' THEN 'service'
        WHEN 'service' THEN 'service'
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

CREATE OR REPLACE FUNCTION loyalty_deposit_person_key(value jsonb)
RETURNS text
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT COALESCE(value->'person'->>'key', value->'person'->>'personKey', value->'person'->>'id', '');
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
    IF mode NOT IN ('dated', 'fixed') THEN
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

CREATE OR REPLACE FUNCTION loyalty_deposit_service_owner(
    p_tenant_id text,
    p_person_key text,
    p_at timestamp
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    selected_id text := '';
BEGIN
    IF COALESCE(p_person_key, '') = '' THEN
        RETURN '';
    END IF;

    SELECT f."sourceId"
    INTO selected_id
    FROM "FinanceOperation" f
    WHERE f."tenantId" = p_tenant_id
      AND f."kind" = 'deposit-funding'
      AND f."sourceType" = 'deposit'
      AND f."status" = 'completed'
      AND f."occurredAt" <= p_at
      AND loyalty_deposit_person_key(f."data") = p_person_key
      AND loyalty_deposit_benefit_mode(COALESCE(f."data"->'terms', '{}'::jsonb)) = 'service'
      AND loyalty_deposit_terms_active(COALESCE(f."data"->'terms', '{}'::jsonb), p_at)
      AND NOT EXISTS (
          SELECT 1
          FROM "FinanceOperation" w
          WHERE w."tenantId" = p_tenant_id
            AND w."kind" = 'deposit-withdrawal'
            AND w."sourceType" = 'deposit'
            AND w."sourceId" = f."sourceId"
            AND w."status" = 'completed'
            AND w."occurredAt" <= p_at
      )
    ORDER BY f."occurredAt" DESC, f."createdAt" DESC
    LIMIT 1;

    RETURN COALESCE(selected_id, '');
END;
$$;

CREATE OR REPLACE FUNCTION loyalty_deposit_recalculate(p_tenant_id text, p_deposit_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    funding "FinanceOperation"%ROWTYPE;
    operation_row "FinanceOperation"%ROWTYPE;
    terms_value jsonb := '{}'::jsonb;
    owner_key text := '';
    benefit_mode text := 'none';
    benefit_rate numeric := 0;
    funding_amount numeric(14,2) := 0;
    principal numeric(14,2) := 0;
    benefit numeric(14,2) := 0;
    allocation_amount numeric(14,2) := 0;
    earned_amount numeric(14,2) := 0;
    principal_used numeric(14,2) := 0;
    benefit_used numeric(14,2) := 0;
    refund_amount numeric(14,2) := 0;
    refund_principal numeric(14,2) := 0;
    refund_benefit numeric(14,2) := 0;
    original_split jsonb := '{}'::jsonb;
    original_service numeric(14,2) := 0;
    reverse_earned numeric(14,2) := 0;
    already_principal numeric(14,2) := 0;
    already_benefit numeric(14,2) := 0;
    already_earned numeric(14,2) := 0;
    payment_splits jsonb := '{}'::jsonb;
    restored_splits jsonb := '{}'::jsonb;
    status_value text := 'active';
    selected_service_id text := '';
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
    owner_key := loyalty_deposit_person_key(funding."data");
    benefit_mode := loyalty_deposit_benefit_mode(terms_value);
    benefit_rate := loyalty_deposit_benefit_rate(terms_value);

    IF benefit_mode = 'upfront' AND benefit_rate > 0 THEN
        benefit := ROUND((funding_amount * benefit_rate / 100.0)::numeric, 2);
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
            IF status_value = 'active' THEN
                principal := GREATEST(0, principal - loyalty_deposit_amount(operation_row."data"));
                benefit := 0;
                status_value := 'closed';
            END IF;
            CONTINUE;
        END IF;

        IF operation_row."kind" = 'payment' THEN
            IF status_value <> 'active' THEN
                CONTINUE;
            END IF;

            earned_amount := 0;
            IF benefit_mode = 'service'
               AND owner_key <> ''
               AND loyalty_deposit_person_key(operation_row."data") = owner_key
               AND loyalty_deposit_terms_active(terms_value, operation_row."occurredAt") THEN
                selected_service_id := loyalty_deposit_service_owner(p_tenant_id, owner_key, operation_row."occurredAt");
                IF selected_service_id = p_deposit_id THEN
                    earned_amount := ROUND((GREATEST(0, loyalty_deposit_number(operation_row."data"->>'serviceAmount')) * benefit_rate / 100.0)::numeric, 2);
                    benefit := benefit + earned_amount;
                END IF;
            END IF;

            allocation_amount := GREATEST(0, loyalty_deposit_allocation(operation_row."data", p_deposit_id));
            principal_used := LEAST(principal, allocation_amount);
            principal := GREATEST(0, principal - principal_used);
            benefit_used := LEAST(benefit, GREATEST(0, allocation_amount - principal_used));
            benefit := GREATEST(0, benefit - benefit_used);

            payment_splits := jsonb_set(
                payment_splits,
                ARRAY[operation_row."operationId"],
                jsonb_build_object(
                    'principal', principal_used,
                    'benefit', benefit_used,
                    'earned', earned_amount,
                    'service', GREATEST(0, loyalty_deposit_number(operation_row."data"->>'serviceAmount'))
                ),
                true
            );
            CONTINUE;
        END IF;

        IF operation_row."kind" = 'refund' THEN
            original_split := COALESCE(payment_splits->operation_row."originalOperationId", '{}'::jsonb);
            IF original_split = '{}'::jsonb THEN
                CONTINUE;
            END IF;

            original_service := GREATEST(0, loyalty_deposit_number(original_split->>'service'));
            already_earned := GREATEST(0, loyalty_deposit_number(COALESCE(restored_splits->operation_row."originalOperationId", '{}'::jsonb)->>'earned'));
            IF original_service > 0 THEN
                reverse_earned := ROUND((
                    GREATEST(0, loyalty_deposit_number(original_split->>'earned'))
                    * LEAST(1::numeric, GREATEST(0, loyalty_deposit_number(operation_row."data"->>'serviceAmount')) / original_service)
                )::numeric, 2);
                reverse_earned := GREATEST(0, reverse_earned - already_earned);
                benefit := GREATEST(0, benefit - reverse_earned);
                already_earned := already_earned + reverse_earned;
            END IF;

            refund_amount := GREATEST(0, loyalty_deposit_allocation(operation_row."data", p_deposit_id));
            already_principal := GREATEST(0, loyalty_deposit_number(COALESCE(restored_splits->operation_row."originalOperationId", '{}'::jsonb)->>'principal'));
            already_benefit := GREATEST(0, loyalty_deposit_number(COALESCE(restored_splits->operation_row."originalOperationId", '{}'::jsonb)->>'benefit'));

            refund_principal := LEAST(
                refund_amount,
                GREATEST(0, loyalty_deposit_number(original_split->>'principal') - already_principal)
            );
            refund_benefit := LEAST(
                GREATEST(0, refund_amount - refund_principal),
                GREATEST(0, loyalty_deposit_number(original_split->>'benefit') - already_benefit)
            );
            principal := principal + refund_principal;
            benefit := benefit + refund_benefit;
            already_principal := already_principal + refund_principal;
            already_benefit := already_benefit + refund_benefit;

            restored_splits := jsonb_set(
                restored_splits,
                ARRAY[operation_row."originalOperationId"],
                jsonb_build_object('principal', already_principal, 'benefit', already_benefit, 'earned', already_earned),
                true
            );
        END IF;
    END LOOP;

    IF status_value = 'active' AND NOT loyalty_deposit_terms_active(terms_value, CURRENT_TIMESTAMP) THEN
        principal := 0;
        benefit := 0;
        status_value := 'expired';
    ELSIF status_value = 'active' AND benefit_mode = 'upfront' AND principal + benefit <= 0.009 THEN
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
        owner_key,
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

CREATE OR REPLACE FUNCTION loyalty_deposit_finance_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    affected text[] := ARRAY[]::text[];
    candidate text;
    tenant_id text;
    person_key_value text;
    row_record record;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        FOREACH candidate IN ARRAY loyalty_deposit_operation_ids(OLD)
        LOOP
            IF candidate <> '' AND NOT (candidate = ANY(affected)) THEN
                affected := array_append(affected, candidate);
            END IF;
        END LOOP;
        IF OLD."kind" IN ('payment', 'refund') THEN
            person_key_value := loyalty_deposit_person_key(OLD."data");
            IF person_key_value <> '' THEN
                FOR row_record IN
                    SELECT "depositId"
                    FROM "LoyaltyDepositInstance"
                    WHERE "tenantId" = OLD."tenantId"
                      AND "personKey" = person_key_value
                      AND loyalty_deposit_benefit_mode("terms") = 'service'
                LOOP
                    IF NOT (row_record."depositId" = ANY(affected)) THEN
                        affected := array_append(affected, row_record."depositId");
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        FOREACH candidate IN ARRAY loyalty_deposit_operation_ids(NEW)
        LOOP
            IF candidate <> '' AND NOT (candidate = ANY(affected)) THEN
                affected := array_append(affected, candidate);
            END IF;
        END LOOP;
        IF NEW."kind" IN ('payment', 'refund') THEN
            person_key_value := loyalty_deposit_person_key(NEW."data");
            IF person_key_value <> '' THEN
                FOR row_record IN
                    SELECT "depositId"
                    FROM "LoyaltyDepositInstance"
                    WHERE "tenantId" = NEW."tenantId"
                      AND "personKey" = person_key_value
                      AND loyalty_deposit_benefit_mode("terms") = 'service'
                LOOP
                    IF NOT (row_record."depositId" = ANY(affected)) THEN
                        affected := array_append(affected, row_record."depositId");
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END IF;

    tenant_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."tenantId" ELSE NEW."tenantId" END;
    FOREACH candidate IN ARRAY affected
    LOOP
        PERFORM loyalty_deposit_recalculate(tenant_id, candidate);
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Recalculate all existing instances with the new split-balance model.
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