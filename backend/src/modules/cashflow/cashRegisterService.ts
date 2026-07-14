import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma";

export const CASH_ACCOUNTS = ["DAILY_SALES", "RENT", "PAYROLL", "SAVINGS"] as const;
export type CashAccount = (typeof CASH_ACCOUNTS)[number];

export const ACCOUNT_LABEL: Record<CashAccount, string> = {
  DAILY_SALES: "Ventas del Día",
  RENT: "Renta",
  PAYROLL: "Pago de Trabajadores",
  SAVINGS: "Ahorro",
};

/** Saldo actual de una cuenta = balanceAfter del último movimiento de esa cuenta. */
export async function getAccountBalance(account: CashAccount): Promise<number> {
  const latest = await prisma.cashMovement.findFirst({ where: { account }, orderBy: { createdAt: "desc" } });
  return latest ? Number(latest.balanceAfter) : 0;
}

/** Saldo de las 4 cuentas de efectivo. */
export async function getAllAccountBalances(): Promise<Record<CashAccount, number>> {
  const entries = await Promise.all(
    CASH_ACCOUNTS.map(async (account) => [account, await getAccountBalance(account)] as const)
  );
  return Object.fromEntries(entries) as Record<CashAccount, number>;
}

/** Efectivo en caja total = suma de las 4 cuentas. */
export async function getCashOnHand(): Promise<number> {
  const balances = await getAllAccountBalances();
  return CASH_ACCOUNTS.reduce((sum, account) => sum + balances[account], 0);
}

/**
 * Registra un movimiento de efectivo (depósito, retiro, o pago de factura) en
 * una cuenta específica y devuelve el nuevo saldo de esa cuenta. Todo
 * movimiento queda en bitácora — nunca se sobreescribe un saldo suelto.
 */
export async function recordCashMovement(params: {
  account: CashAccount;
  type: "DEPOSIT" | "WITHDRAWAL" | "PAYMENT";
  amount: number;
  invoiceId?: string;
  notes?: string;
  createdById: string;
}) {
  const current = await getAccountBalance(params.account);
  const delta = params.type === "DEPOSIT" ? params.amount : -params.amount;
  const balanceAfter = current + delta;

  return prisma.cashMovement.create({
    data: {
      account: params.account,
      type: params.type,
      amount: params.amount,
      balanceAfter,
      invoiceId: params.invoiceId,
      notes: params.notes,
      createdById: params.createdById,
    },
  });
}

/**
 * Transferencia entre las 4 cuentas de efectivo — no es dinero nuevo, es
 * reasignar efectivo que ya existe (ej. mover ventas del día hacia ahorro o
 * renta). Se registran dos movimientos ligados por `relatedTransferId`
 * (TRANSFER_OUT en origen, TRANSFER_IN en destino) para que cada cuenta
 * mantenga su propia bitácora y saldo corriente.
 */
export async function transferBetweenAccounts(params: {
  fromAccount: CashAccount;
  toAccount: CashAccount;
  amount: number;
  notes?: string;
  createdById: string;
}) {
  if (params.fromAccount === params.toAccount) {
    throw new Error("La cuenta de origen y destino no pueden ser la misma.");
  }
  if (params.amount <= 0) {
    throw new Error("El monto debe ser mayor a cero.");
  }

  const fromBalance = await getAccountBalance(params.fromAccount);
  if (fromBalance < params.amount) {
    throw new Error(`Saldo insuficiente en ${ACCOUNT_LABEL[params.fromAccount]} para esta transferencia.`);
  }
  const toBalance = await getAccountBalance(params.toAccount);

  const relatedTransferId = randomUUID();

  const out = await prisma.cashMovement.create({
    data: {
      account: params.fromAccount,
      type: "TRANSFER_OUT",
      amount: params.amount,
      balanceAfter: fromBalance - params.amount,
      relatedTransferId,
      notes: params.notes,
      createdById: params.createdById,
    },
  });

  const into = await prisma.cashMovement.create({
    data: {
      account: params.toAccount,
      type: "TRANSFER_IN",
      amount: params.amount,
      balanceAfter: toBalance + params.amount,
      relatedTransferId,
      notes: params.notes,
      createdById: params.createdById,
    },
  });

  return { out, into };
}
