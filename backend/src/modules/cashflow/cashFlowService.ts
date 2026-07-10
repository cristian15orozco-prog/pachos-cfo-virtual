import { prisma } from "../../lib/prisma";
import { getAccountsBalance } from "../../integrations/plaid/plaidClient";
import { decryptToken } from "../../lib/tokenCrypto";
import { getCashOnHand } from "./cashRegisterService";

const PROJECTION_WINDOWS = [7, 15, 30] as const;

async function getBankAvailableBalance(): Promise<number> {
  const connection = await prisma.bankConnection.findFirst({ where: { status: "ACTIVE" } });
  if (!connection) return 0;

  const accessToken = decryptToken(connection.accessTokenEncrypted);
  const accounts = await getAccountsBalance(accessToken); // solo lectura
  return accounts.reduce((sum, acc) => sum + (acc.balances.available ?? acc.balances.current ?? 0), 0);
}

/**
 * Promedio móvil de entradas históricas, usado como estimador simple de
 * entradas esperadas (fase 1). Combina dos fuentes:
 *  - Depósitos bancarios (tarjeta/transferencias), sincronizados vía Plaid.
 *  - Depósitos de efectivo (ventas en efectivo), registrados manualmente
 *    en la caja — Plaid nunca ve ese dinero porque no pasa por el banco.
 */
async function estimateExpectedInflows(days: number): Promise<number> {
  const lookbackDays = 60;
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const [bankDeposits, cashDeposits] = await Promise.all([
    prisma.bankTransaction.findMany({ where: { type: "DEPOSIT", transactionDate: { gte: since } } }),
    prisma.cashMovement.findMany({ where: { type: "DEPOSIT", createdAt: { gte: since } } }),
  ]);

  const bankTotal = bankDeposits.reduce((sum, d) => sum + Number(d.amount), 0);
  const cashTotal = cashDeposits.reduce((sum, d) => sum + Number(d.amount), 0);
  if (bankTotal === 0 && cashTotal === 0) return 0;

  const dailyAverage = (bankTotal + cashTotal) / lookbackDays;
  return dailyAverage * days;
}

async function estimateExpectedOutflows(days: number): Promise<number> {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + days);

  const [invoicesDue, checksPending] = await Promise.all([
    prisma.invoice.findMany({
      where: { dueDate: { lte: horizon }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
    }),
    prisma.check.findMany({ where: { status: { in: ["ISSUED", "PENDING"] } } }),
  ]);

  const invoiceTotal = invoicesDue.reduce((sum, inv) => sum + Number(inv.total), 0);
  const checkTotal = checksPending.reduce((sum, c) => sum + Number(c.amount), 0);
  return invoiceTotal + checkTotal;
}

export interface CashFlowSummary {
  availableToday: number;
  cashOnHand: number;
  projections: Record<(typeof PROJECTION_WINDOWS)[number], number>;
  willGoNegative: boolean;
  negativeAtDays: number | null;
}

/** Calcula y persiste el snapshot diario de flujo de caja. Ver docs/BUSINESS_RULES.md sección 5. */
export async function computeCashFlowProjection(): Promise<CashFlowSummary> {
  const [bankBalance, cashOnHand] = await Promise.all([getBankAvailableBalance(), getCashOnHand()]);
  const availableToday = bankBalance + cashOnHand;

  const projections: Record<number, number> = {};
  let willGoNegative = false;
  let negativeAtDays: number | null = null;

  for (const days of PROJECTION_WINDOWS) {
    const [inflows, outflows] = await Promise.all([
      estimateExpectedInflows(days),
      estimateExpectedOutflows(days),
    ]);
    const projected = availableToday + inflows - outflows;
    projections[days] = projected;
    if (projected < 0 && !willGoNegative) {
      willGoNegative = true;
      negativeAtDays = days;
    }
  }

  const [inflows30, outflows30] = await Promise.all([
    estimateExpectedInflows(30),
    estimateExpectedOutflows(30),
  ]);

  await prisma.cashFlowProjection.upsert({
    where: { snapshotDate: new Date(new Date().toDateString()) },
    update: {
      availableToday,
      projected7d: projections[7],
      projected15d: projections[15],
      projected30d: projections[30],
      expectedInflows: inflows30,
      expectedOutflows: outflows30,
      willGoNegative,
      negativeDate: negativeAtDays
        ? new Date(Date.now() + negativeAtDays * 24 * 60 * 60 * 1000)
        : null,
    },
    create: {
      snapshotDate: new Date(new Date().toDateString()),
      availableToday,
      projected7d: projections[7],
      projected15d: projections[15],
      projected30d: projections[30],
      expectedInflows: inflows30,
      expectedOutflows: outflows30,
      willGoNegative,
      negativeDate: negativeAtDays
        ? new Date(Date.now() + negativeAtDays * 24 * 60 * 60 * 1000)
        : null,
    },
  });

  if (willGoNegative) {
    const alreadyOpen = await prisma.alert.findFirst({
      where: { type: "CASHFLOW_LOW_15D", status: "OPEN" },
    });
    if (!alreadyOpen) {
      await prisma.alert.create({
        data: {
          type: "CASHFLOW_LOW_15D",
          severity: "CRITICAL",
          message: "El flujo de caja puede quedar bajo (o negativo) en los próximos días. Revisa pagos y cheques pendientes.",
          entityType: "cashflow",
        },
      });
    }
  }

  return {
    availableToday,
    cashOnHand,
    projections: projections as CashFlowSummary["projections"],
    willGoNegative,
    negativeAtDays,
  };
}
