UPDATE "BusinessRecord"
SET "data" = ("data" - 'client') || jsonb_build_object('person', "data"->'client')
WHERE "data" ? 'client';

UPDATE "BusinessRecord"
SET "data" = ("data" - 'clientDiscountPercent') || jsonb_build_object('personDiscountPercent', "data"->'clientDiscountPercent')
WHERE "data" ? 'clientDiscountPercent';

UPDATE "BusinessAuxiliaryState"
SET "data" = jsonb_set(
  jsonb_set(
    "data",
    '{finance,income}',
    COALESCE((
      SELECT jsonb_agg(
        CASE
          WHEN item ? 'client' THEN (item - 'client') || jsonb_build_object('person', item->'client')
          ELSE item
        END
      )
      FROM jsonb_array_elements(COALESCE("data"#>'{finance,income}', '[]'::jsonb)) AS item
    ), '[]'::jsonb),
    true
  ),
  '{finance,expense}',
  COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN item ? 'client' THEN (item - 'client') || jsonb_build_object('person', item->'client')
        ELSE item
      END
    )
    FROM jsonb_array_elements(COALESCE("data"#>'{finance,expense}', '[]'::jsonb)) AS item
  ), '[]'::jsonb),
  true
)
WHERE "data" ? 'finance';
