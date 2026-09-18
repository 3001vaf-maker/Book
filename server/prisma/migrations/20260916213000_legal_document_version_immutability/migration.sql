-- Published legal document versions are evidence snapshots.
-- Their content and identity fields are immutable. The only permitted UPDATE is
-- the one-way transition supersededAt: NULL -> timestamp when a newer version is published.

BEGIN;

CREATE OR REPLACE FUNCTION "book_guard_legal_document_version"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'LegalDocumentVersion is immutable and cannot be deleted';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."documentId" IS DISTINCT FROM OLD."documentId"
     OR NEW."version" IS DISTINCT FROM OLD."version"
     OR NEW."contentSnapshot" IS DISTINCT FROM OLD."contentSnapshot"
     OR NEW."contentHash" IS DISTINCT FROM OLD."contentHash"
     OR NEW."operatorIdentitySnapshot" IS DISTINCT FROM OLD."operatorIdentitySnapshot"
     OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" THEN
    RAISE EXCEPTION 'Published LegalDocumentVersion evidence is immutable';
  END IF;

  IF OLD."supersededAt" IS NOT NULL
     AND NEW."supersededAt" IS DISTINCT FROM OLD."supersededAt" THEN
    RAISE EXCEPTION 'LegalDocumentVersion supersededAt is immutable once set';
  END IF;

  IF OLD."supersededAt" IS NULL AND NEW."supersededAt" IS NULL THEN
    RAISE EXCEPTION 'LegalDocumentVersion update has no permitted change';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "LegalDocumentVersion_immutable" ON "LegalDocumentVersion";
CREATE TRIGGER "LegalDocumentVersion_immutable"
BEFORE UPDATE OR DELETE ON "LegalDocumentVersion"
FOR EACH ROW EXECUTE FUNCTION "book_guard_legal_document_version"();

COMMIT;
