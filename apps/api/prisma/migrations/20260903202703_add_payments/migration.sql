
-- AlterEnum
ALTER TYPE "invoice_status" ADD VALUE 'processing';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "stripeSessionId" TEXT;

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripeSessionId_key" ON "invoices"("stripeSessionId");

