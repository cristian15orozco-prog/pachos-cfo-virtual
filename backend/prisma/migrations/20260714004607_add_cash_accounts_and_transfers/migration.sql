-- CreateEnum
CREATE TYPE "CashAccountType" AS ENUM ('DAILY_SALES', 'RENT', 'PAYROLL', 'SAVINGS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CashMovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "CashMovementType" ADD VALUE 'TRANSFER_IN';

-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "account" "CashAccountType" NOT NULL DEFAULT 'DAILY_SALES',
ADD COLUMN     "related_transfer_id" TEXT;

-- CreateIndex
CREATE INDEX "cash_movements_account_created_at_idx" ON "cash_movements"("account", "created_at");
