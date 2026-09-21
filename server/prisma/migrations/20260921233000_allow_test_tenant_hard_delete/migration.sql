BEGIN;

CREATE OR REPLACE FUNCTION "book_reject_document_registry_event_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('book.allow_test_tenant_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

COMMIT;
