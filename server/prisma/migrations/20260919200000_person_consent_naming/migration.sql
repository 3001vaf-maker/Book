UPDATE "TenantDocumentArchive"
SET "data" = jsonb_set(
  "data",
  '{documents}',
  COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN item ? 'clientConsent'
          THEN (item - 'clientConsent') || jsonb_build_object('personConsent', item->'clientConsent')
        ELSE item
      END
    )
    FROM jsonb_array_elements(COALESCE("data"->'documents', '[]'::jsonb)) AS item
  ), '[]'::jsonb),
  true
)
WHERE "data" ? 'documents';
