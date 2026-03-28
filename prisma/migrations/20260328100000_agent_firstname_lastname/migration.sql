-- Split "name" into "first_name" and "last_name"
ALTER TABLE "agents" ADD COLUMN "first_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "agents" ADD COLUMN "last_name" TEXT NOT NULL DEFAULT '';

-- Migrate existing data: put the full name in last_name
UPDATE "agents" SET "last_name" = "name" WHERE "name" IS NOT NULL;

-- Drop the old column
ALTER TABLE "agents" DROP COLUMN "name";
