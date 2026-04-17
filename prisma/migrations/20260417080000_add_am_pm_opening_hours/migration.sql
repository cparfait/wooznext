-- AlterTable: add AM/PM opening hours support
ALTER TABLE "opening_hours" ADD COLUMN "open_time_pm" TEXT;
ALTER TABLE "opening_hours" ADD COLUMN "close_time_pm" TEXT;
ALTER TABLE "opening_hours" ADD COLUMN "is_closed_pm" BOOLEAN NOT NULL DEFAULT false;
