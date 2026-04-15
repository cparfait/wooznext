-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "returned_to_queue" BOOLEAN NOT NULL DEFAULT false;
