-- Platform admin identifiers and User identifiers are different concepts.
-- Legal event stores persist actorUserId; when a platform-admin id is supplied by the
-- existing SaaS admin flow, normalize it to PlatformAdmin.userId before FK validation.

BEGIN;

CREATE OR REPLACE FUNCTION "book_normalize_legal_actor_user"() RETURNS trigger AS $$
DECLARE
  resolved_user_id TEXT;
BEGIN
  IF NEW."actorUserId" IS NULL OR NEW."actorUserId" = '' THEN
    NEW."actorUserId" := NULL;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM "User" WHERE "id" = NEW."actorUserId") THEN
    RETURN NEW;
  END IF;

  SELECT "userId" INTO resolved_user_id
  FROM "PlatformAdmin"
  WHERE "id" = NEW."actorUserId"
  LIMIT 1;

  IF resolved_user_id IS NOT NULL THEN
    NEW."actorUserId" := resolved_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LegalStateEvent_normalize_actor"
BEFORE INSERT ON "LegalStateEvent"
FOR EACH ROW EXECUTE FUNCTION "book_normalize_legal_actor_user"();

CREATE TRIGGER "LegalAuditEvent_normalize_actor"
BEFORE INSERT ON "LegalAuditEvent"
FOR EACH ROW EXECUTE FUNCTION "book_normalize_legal_actor_user"();

COMMIT;
