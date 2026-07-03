import { prisma } from "../../lib/prisma";

const DUPLICATE_DATE_WINDOW_DAYS = 3;

/**
 * Detecta si una factura es probablemente duplicada:
 * - mismo proveedor + mismo número de factura, o
 * - mismo proveedor + mismo total + fecha de factura dentro de +/- 3 días.
 * Ver docs/BUSINESS_RULES.md sección 3.
 */
export async function findPossibleDuplicates(invoice: {
  id?: string;
  providerId: string;
  invoiceNumber: string;
  total: number;
  invoiceDate: Date;
}) {
  const windowStart = new Date(invoice.invoiceDate);
  windowStart.setDate(windowStart.getDate() - DUPLICATE_DATE_WINDOW_DAYS);
  const windowEnd = new Date(invoice.invoiceDate);
  windowEnd.setDate(windowEnd.getDate() + DUPLICATE_DATE_WINDOW_DAYS);

  return prisma.invoice.findMany({
    where: {
      id: invoice.id ? { not: invoice.id } : undefined,
      providerId: invoice.providerId,
      OR: [
        { invoiceNumber: invoice.invoiceNumber },
        {
          total: invoice.total,
          invoiceDate: { gte: windowStart, lte: windowEnd },
        },
      ],
    },
  });
}

export async function findInvoicesWithoutReceipt() {
  return prisma.invoice.findMany({
    where: { attachments: { none: {} } },
    include: { provider: true },
  });
}

export async function findOverdueInvoices() {
  return prisma.invoice.findMany({
    where: { dueDate: { lt: new Date() }, status: { not: "PAID" } },
    include: { provider: true },
  });
}

/** Facturas cuyo pago bancario conciliado difiere del monto facturado. */
export async function findAmountMismatches() {
  const payments = await prisma.payment.findMany({
    where: { bankTransactionId: { not: null } },
    include: { invoice: true, bankTransaction: true },
  });
  return payments.filter(
    (p) => p.bankTransaction && Number(p.bankTransaction.amount) !== Number(p.invoice.total)
  );
}
