ALTER TABLE "services" ADD COLUMN "ticker_position" TEXT NOT NULL DEFAULT 'bottom';
ALTER TABLE "services" ADD COLUMN "ticker_height" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "services" ADD COLUMN "ticker_bg_color" TEXT NOT NULL DEFAULT '#dc2626';
ALTER TABLE "services" ADD COLUMN "ticker_text_color" TEXT NOT NULL DEFAULT '#ffffff';
ALTER TABLE "services" ADD COLUMN "ticker_font_size" INTEGER NOT NULL DEFAULT 18;
