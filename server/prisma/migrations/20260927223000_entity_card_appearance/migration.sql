ALTER TABLE "Profile" ADD COLUMN "cardAppearance" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "Workplace" ADD COLUMN "cardAppearance" JSONB NOT NULL DEFAULT '{}'::jsonb;
