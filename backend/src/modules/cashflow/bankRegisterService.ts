import { prisma } from "../../lib/prisma";

/** Saldo manual de banco = balanceAfter del último movimiento registrado. */
export async function getManualBankBalance(): Promise<number> {
  const latest = await prisma.bankMovement.findFirst({ orderBy: { createdAt: "desc" } });
  return latest ? Number(latest.balanceAfter) : 0;
}

export async function recordBankMovement(params: {
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  notes?: string;
  createdById: string;
}) {
  const current = await getManualBankBalance();
  const delta = params.type === "DEPOSIT" ? params.amount : -params.amount;
  const balanceAfter = current + delta;

  return prisma.bankMovement.create({
    data: {
      type: params.type,
      amount: params.amount,
      balanceAfter,
      notes: params.notes,
      createdById: params.createdById,
    },
  });
}
