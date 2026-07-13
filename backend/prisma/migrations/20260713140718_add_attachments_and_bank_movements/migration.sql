/*
  Warnings:

  - You are about to drop the column `file_url` on the `attachments` table. All the data in the column will be lost.
  - Added the required column `file_data` to the `attachments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BankMovementType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- AlterTable
ALTER TABLE "attachments" DROP COLUMN "file_url",
ADD COLUMN     "file_data" BYTEA NOT NULL,
ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "bank_movements" (
    "id" TEXT NOT NULL,
    "type" "BankMovementType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_movements_created_at_idx" ON "bank_movements"("created_at");

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
