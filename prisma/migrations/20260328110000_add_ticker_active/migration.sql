-- Add ticker active toggle
ALTER TABLE "services" ADD COLUMN "ticker_active" BOOLEAN NOT NULL DEFAULT true;
