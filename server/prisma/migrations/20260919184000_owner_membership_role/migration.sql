BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Membership"
    WHERE "role"::text <> 'OWNER'
  ) THEN
    RAISE EXCEPTION 'Membership contains a non-OWNER role; refusing role cleanup';
  END IF;
END
$$;

ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "MembershipRole" RENAME TO "MembershipRole_old";
CREATE TYPE "MembershipRole" AS ENUM ('OWNER');

ALTER TABLE "Membership"
  ALTER COLUMN "role" TYPE "MembershipRole"
  USING ("role"::text::"MembershipRole");

ALTER TABLE "Membership"
  ALTER COLUMN "role" SET DEFAULT 'OWNER';

DROP TYPE "MembershipRole_old";

COMMIT;
