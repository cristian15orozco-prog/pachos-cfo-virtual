-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "business_settings" (
    "id" TEXT NOT NULL,
    "daily_rent_amount" DECIMAL(14,2) NOT NULL DEFAULT 600,
    "weekly_payroll_amount" DECIMAL(14,2) NOT NULL DEFAULT 5500,
    "last_payroll_week_start" DATE,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);
