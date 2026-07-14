-- CreateEnum
CREATE TYPE "AttachmentPaymentHint" AS ENUM ('CASH', 'CHECK', 'UNPAID');

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "payment_hint" "AttachmentPaymentHint";
