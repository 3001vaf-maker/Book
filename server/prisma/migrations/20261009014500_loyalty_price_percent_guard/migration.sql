-- A person may have only one active PRICE_PERCENT source at a time.
-- Personal conditions and Loyalty programs are alternative sources, never additive.
-- Manual price correction belongs to the concrete Settlement and is not a PRICE_PERCENT source.

CREATE OR REPLACE FUNCTION loyalty_person_discount_percent(value jsonb)
RETURNS numeric
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT GREATEST(
        0::numeric,
        LEAST(
            100::numeric,
            loyalty_deposit_number(COALESCE(value->>'discountPercent', value->>'discount', '0'))
        )
    );
$$;

CREATE OR REPLACE FUNCTION loyalty_active_program_price_percent_count(
    p_tenant_id text,
    p_person_key text,
    p_exclude_deposit_id text DEFAULT ''
)
RETURNS integer
LANGUAGE SQL
STABLE
AS $$
    SELECT COUNT(*)::integer
    FROM "LoyaltyDepositInstance" d
    WHERE d."tenantId" = p_tenant_id
      AND d."personKey" = p_person_key
      AND d."status" = 'active'
      AND d."depositId" <> COALESCE(p_exclude_deposit_id, '')
      AND loyalty_deposit_benefit_mode(COALESCE(d."terms", '{}'::jsonb)) = 'discount'
      AND loyalty_deposit_benefit_rate(COALESCE(d."terms", '{}'::jsonb)) > 0
      AND loyalty_deposit_terms_active(COALESCE(d."terms", '{}'::jsonb), CURRENT_TIMESTAMP::timestamp);
$$;

CREATE OR REPLACE FUNCTION loyalty_person_price_percent_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    next_percent numeric := loyalty_person_discount_percent(COALESCE(NEW."data", '{}'::jsonb));
    previous_percent numeric := 0;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        previous_percent := loyalty_person_discount_percent(COALESCE(OLD."data", '{}'::jsonb));
    END IF;

    -- Do not block unrelated Person edits for an already-conflicting legacy row.
    -- The guard runs when a positive personal percentage is newly assigned or changed.
    IF next_percent > 0
       AND (TG_OP = 'INSERT' OR next_percent IS DISTINCT FROM previous_percent)
       AND loyalty_active_program_price_percent_count(NEW."tenantId", NEW."key") > 0 THEN
        RAISE EXCEPTION 'У контакта уже действует процентная скидка по программе. Сначала уберите процент программы или завершите её действие.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "PersonSinglePricePercentGuard" ON "Person";
CREATE TRIGGER "PersonSinglePricePercentGuard"
BEFORE INSERT OR UPDATE OF "data" ON "Person"
FOR EACH ROW EXECUTE FUNCTION loyalty_person_price_percent_guard();

CREATE OR REPLACE FUNCTION loyalty_deposit_price_percent_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    personal_percent numeric := 0;
BEGIN
    IF NEW."status" <> 'active'
       OR loyalty_deposit_benefit_mode(COALESCE(NEW."terms", '{}'::jsonb)) <> 'discount'
       OR loyalty_deposit_benefit_rate(COALESCE(NEW."terms", '{}'::jsonb)) <= 0
       OR NOT loyalty_deposit_terms_active(COALESCE(NEW."terms", '{}'::jsonb), CURRENT_TIMESTAMP::timestamp) THEN
        RETURN NEW;
    END IF;

    SELECT loyalty_person_discount_percent(COALESCE(p."data", '{}'::jsonb))
    INTO personal_percent
    FROM "Person" p
    WHERE p."tenantId" = NEW."tenantId" AND p."key" = NEW."personKey"
    LIMIT 1;

    IF COALESCE(personal_percent, 0) > 0 THEN
        RAISE EXCEPTION 'У контакта уже действует личная процентная скидка. Сначала уберите личную скидку, затем оформите программу.'
            USING ERRCODE = '23514';
    END IF;

    IF loyalty_active_program_price_percent_count(NEW."tenantId", NEW."personKey", NEW."depositId") > 0 THEN
        RAISE EXCEPTION 'У контакта уже действует процентная скидка по другой программе. Одновременно может действовать только одна процентная скидка.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "DepositSinglePricePercentGuard" ON "LoyaltyDepositInstance";
CREATE TRIGGER "DepositSinglePricePercentGuard"
BEFORE INSERT ON "LoyaltyDepositInstance"
FOR EACH ROW EXECUTE FUNCTION loyalty_deposit_price_percent_guard();

CREATE OR REPLACE FUNCTION loyalty_payment_price_percent_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    person_key text := '';
    personal_count integer := 0;
    program_count integer := 0;
BEGIN
    IF NEW."kind" <> 'payment' OR NEW."status" <> 'completed' THEN
        RETURN NEW;
    END IF;

    person_key := COALESCE(
        NEW."data"->'person'->>'key',
        NEW."data"->'person'->>'personKey',
        NEW."data"->'person'->>'id',
        ''
    );
    IF person_key = '' THEN
        RETURN NEW;
    END IF;

    SELECT CASE
        WHEN loyalty_person_discount_percent(COALESCE(p."data", '{}'::jsonb)) > 0 THEN 1
        ELSE 0
    END
    INTO personal_count
    FROM "Person" p
    WHERE p."tenantId" = NEW."tenantId" AND p."key" = person_key
    LIMIT 1;

    program_count := loyalty_active_program_price_percent_count(NEW."tenantId", person_key);

    IF COALESCE(personal_count, 0) + COALESCE(program_count, 0) > 1 THEN
        RAISE EXCEPTION 'Оплата остановлена: у контакта одновременно действуют несколько источников процентной скидки. Оставьте один источник и повторите оплату.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "FinancePaymentSinglePricePercentGuard" ON "FinanceOperation";
CREATE TRIGGER "FinancePaymentSinglePricePercentGuard"
BEFORE INSERT OR UPDATE OF "data", "status" ON "FinanceOperation"
FOR EACH ROW EXECUTE FUNCTION loyalty_payment_price_percent_guard();