BEGIN;

CREATE OR REPLACE FUNCTION "book_reject_document_registry_event_mutation"() RETURNS trigger AS $$
DECLARE
  allow_test_delete TEXT;
BEGIN
  allow_test_delete := current_setting('book.allow_test_tenant_delete', true);

  IF TG_OP = 'DELETE' AND allow_test_delete = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

COMMIT;
