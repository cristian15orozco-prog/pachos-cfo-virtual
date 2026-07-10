import { prisma } from "../../lib/prisma";
import { recordCashMovement } from "../cashflow/cashRegisterService";

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paidAt: Date;
  method: "CASH" | "CHECK";
  createdById: string;
  // Solo para method = "CHECK":
  checkId?: string; // vincular un cheque ya registrado y sin factura asociada
  checkNumber?: string; // o crear uno nuevo con estos datos
  payee?: string;
  bankName?: string;
  issueDate?: Date;
  notes?: string;
}

/**
 * Registra el pago de una factura — nunca mueve dinero, solo dos cosas:
 *  - Efectivo: descuenta del efectivo en caja (bitácora de movimientos).
 *  - Cheque: crea o vincula un cheque con estado ISSUED. Como el banco real
 *    no se ha movido todavía, esto es un "descuento virtual": el motor de
 *    flujo de caja ya resta los cheques ISSUED/PENDING de la proyección,
 *    pero el saldo real de TD Bank solo cambia cuando Plaid confirme que
 *    se cobró.
 * Actualiza el estado de la factura (PARTIAL o PAID) según lo acumulado.
 */
export async function recordInvoicePayment(input: RecordPaymentInput) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: input.invoiceId },
    include: { provider: true },
  });

  let checkId: string | undefined;

  if (input.method === "CHECK") {
    if (input.checkId) {
      const existing = await prisma.check.findUniqueOrThrow({ where: { id: input.checkId } });
      if (existing.invoiceId && existing.invoiceId !== invoice.id) {
        throw new Error("Este cheque ya está asociado a otra factura.");
      }
      await prisma.check.update({ where: { id: existing.id }, data: { invoiceId: invoice.id } });
      checkId = existing.id;
    } else {
      if (!input.checkNumber) throw new Error("Falta el número de cheque.");
      const check = await prisma.check.create({
        data: {
          checkNumber: input.checkNumber,
          payee: input.payee || invoice.provider.name,
          bankName: input.bankName || "TD Bank",
          amount: input.amount,
          issueDate: input.issueDate ?? input.paidAt,
          status: "ISSUED",
          invoiceId: invoice.id,
          notes: input.notes,
          createdById: input.createdById,
        },
      });
      checkId = check.id;
    }
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      checkId,
      amount: input.amount,
      paidAt: input.paidAt,
      method: input.method,
      createdById: input.createdById,
    },
  });

  if (input.method === "CASH") {
    await recordCashMovement({
      type: "PAYMENT",
      amount: input.amount,
      invoiceId: invoice.id,
      notes: `Pago en efectivo de factura ${invoice.invoiceNumber} (${invoice.provider.name})`,
      createdById: input.createdById,
    });
  }

  const totalPaid = await prisma.payment.aggregate({
    where: { invoiceId: invoice.id },
    _sum: { amount: true },
  });
  const newStatus = Number(totalPaid._sum.amount ?? 0) >= Number(invoice.total) ? "PAID" : "PARTIAL";
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: newStatus },
    include: { provider: true, category: true },
  });

  return { payment, invoice: updatedInvoice, checkId };
}
