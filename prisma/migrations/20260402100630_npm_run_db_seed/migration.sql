-- DropForeignKey
ALTER TABLE "counters" DROP CONSTRAINT "counters_service_id_fkey";

-- DropForeignKey
ALTER TABLE "daily_sequences" DROP CONSTRAINT "daily_sequences_service_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_service_id_fkey";

-- AlterTable
ALTER TABLE "agents" ALTER COLUMN "first_name" DROP DEFAULT,
ALTER COLUMN "last_name" DROP DEFAULT;

-- CreateTable
CREATE TABLE "opening_hours" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "open_time" TEXT NOT NULL,
    "close_time" TEXT NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "opening_hours_service_id_dayOfWeek_key" ON "opening_hours"("service_id", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "counters" ADD CONSTRAINT "counters_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_sequences" ADD CONSTRAINT "daily_sequences_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
