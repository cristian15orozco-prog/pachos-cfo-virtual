import { prisma } from "../../lib/prisma";

/** Efectivo en caja actual = balanceAfter del último movimiento registrado. */
export async function getCashOnHand(): Promise<number> {
  const latest = await prisma.cashMovement.findFirst({ orderBy: { createdAt: "desc" } });
  return latest ? Number(latest.balanceAfter) : 0;
}

/**
 * Registra un movimiento de efectivo (depósito, retiro, o pago de factura) y
 * devuelve el nuevo saldo. Todo movimiento queda en bitácora — nunca se
 * sobreescribe un saldo suelto.
 */
export async function recordCashMovement(params: {
  type: "DEPOSIT" | "WITHDRAWAL" | "PAYMENT";
  amount: number;
  invoiceId?: string;
  notes?: string;
  createdById: string;
}) {
  const current = await getCashOnHand();
  const delta = params.type === "DEPOSIT" ? params.amount : -params.amount;
  const balanceAfter = current + delta;

  return prisma.cashMovement.create({
    data: {
      type: params.type,
      amount: params.amount,
      balanceAfter,
      invoiceId: params.invoiceId,
      notes: params.notes,
      createdById: params.createdById,
    },
  });
}
