-- One-time cleanup of legacy price-correction bridges.
-- After this migration runtime uses only:
--   correctionMode / correctionPercent / correctionMoney
-- for manual price correction and pricePercent for the single automatic percentage condition.

CREATE OR REPLACE FUNCTION canonicalize_price_correction_item(item jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    result jsonb := COALESCE(item, '{}'::jsonb);
    mode text := LOWER(COALESCE(item->>'correctionMode', item->>'discountMode', 'none'));
    percent_value numeric := 0;
    money_value numeric := 0;
BEGIN
    IF COALESCE(item->>'correctionPercent', item->>'discountPercent', '') ~ '^-?[0-9]+([.,][0-9]+)?$' THEN
        percent_value := GREATEST(0, LEAST(100, REPLACE(COALESCE(item->>'correctionPercent', item->>'discountPercent'), ',', '.')::numeric));
    END IF;

    IF COALESCE(item->>'correctionMoney', item->>'discountMoney', item->>'discountValue', '') ~ '^-?[0-9]+([.,][0-9]+)?$' THEN
        money_value := GREATEST(0, REPLACE(COALESCE(item->>'correctionMoney', item->>'discountMoney', item->>'discountValue'), ',', '.')::numeric);
    END IF;

    result := result - 'discountMode' - 'discountPercent' - 'discountMoney' - 'discountValue';

    IF mode = 'percent' AND percent_value > 0 THEN
        result := jsonb_set(result, '{correctionMode}', '"percent"'::jsonb, true);
        result := jsonb_set(result, '{correctionPercent}', to_jsonb(percent_value), true);
        result := result - 'correctionMoney';
    ELSIF mode = 'money' AND money_value > 0 THEN
        result := jsonb_set(result, '{correctionMode}', '"money"'::jsonb, true);
        result := jsonb_set(result, '{correctionMoney}', to_jsonb(money_value), true);
        result := result - 'correctionPercent';
    ELSE
        result := jsonb_set(result, '{correctionMode}', '"none"'::jsonb, true);
        result := result - 'correctionPercent' - 'correctionMoney';
    END IF;

    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION canonicalize_settlement_json(value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    source jsonb := COALESCE(value, '{}'::jsonb);
    normalized_items jsonb := '[]'::jsonb;
BEGIN
    IF jsonb_typeof(source->'items') = 'array' THEN
        SELECT COALESCE(jsonb_agg(canonicalize_price_correction_item(item) ORDER BY ord), '[]'::jsonb)
        INTO normalized_items
        FROM jsonb_array_elements(source->'items') WITH ORDINALITY AS rows(item, ord);
        source := jsonb_set(source, '{items}', normalized_items, true);
    END IF;
    RETURN source;
END;
$$;

CREATE OR REPLACE FUNCTION canonicalize_record_price_corrections(value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    source jsonb := COALESCE(value, '{}'::jsonb) - 'personDiscountPercent';
    key text;
    normalized_items jsonb;
BEGIN
    FOREACH key IN ARRAY ARRAY['procedures', 'products'] LOOP
        IF jsonb_typeof(source->key) = 'array' THEN
            SELECT COALESCE(jsonb_agg(canonicalize_price_correction_item(item) ORDER BY ord), '[]'::jsonb)
            INTO normalized_items
            FROM jsonb_array_elements(source->key) WITH ORDINALITY AS rows(item, ord);
            source := jsonb_set(source, ARRAY[key], normalized_items, true);
        END IF;
    END LOOP;
    RETURN source;
END;
$$;

UPDATE "FinanceSettlement"
SET "data" = canonicalize_settlement_json("data")
WHERE jsonb_typeof("data"->'items') = 'array';

UPDATE "FinanceOperation"
SET "data" = jsonb_set("data", '{settlement}', canonicalize_settlement_json("data"->'settlement'), true)
WHERE jsonb_typeof("data"->'settlement') = 'object';

UPDATE "BusinessRecord"
SET "data" = canonicalize_record_price_corrections("data")
WHERE "data" ? 'personDiscountPercent'
   OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(CASE WHEN jsonb_typeof("data"->'procedures') = 'array' THEN "data"->'procedures' ELSE '[]'::jsonb END) item
       WHERE item ?| ARRAY['discountMode', 'discountPercent', 'discountMoney', 'discountValue']
   )
   OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(CASE WHEN jsonb_typeof("data"->'products') = 'array' THEN "data"->'products' ELSE '[]'::jsonb END) item
       WHERE item ?| ARRAY['discountMode', 'discountPercent', 'discountMoney', 'discountValue']
   );

DROP FUNCTION canonicalize_record_price_corrections(jsonb);
DROP FUNCTION canonicalize_settlement_json(jsonb);
DROP FUNCTION canonicalize_price_correction_item(jsonb);