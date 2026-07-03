import { prisma } from "../../lib/prisma";
import { computeCashFlowProjection } from "../cashflow/cashFlowService";
import { getCfoRecommendations } from "./cfoAdvisorService";

/** Reporte diario del dueño. Ver docs/BUSINESS_RULES.md sección 8. */
export async function generateDailyReport(date: Date = new Date()) {
  const startOfDay = new Date(date.toDateString());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const in3Days = new Date(startOfDay.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [
    cashFlow,
    depositsToday,
    paymentsToday,
    checksClearedToday,
    checksPending,
    overdueInvoices,
    dueSoonInvoices,
    criticalAlerts,
    recommendations,
  ] = await Promise.all([
    computeCashFlowProjection(),
    prisma.bankTransaction.findMany({
      where: { type: "DEPOSIT", transactionDate: { gte: startOfDay, lt: endOfDay } },
    }),
    prisma.payment.findMany({ where: { paidAt: { gte: startOfDay, lt: endOfDay } } }),
    prisma.check.findMany({ where: { status: "CLEARED", clearedAt: { gte: startOfDay, lt: endOfDay } } }),
    prisma.check.findMany({ where: { status: { in: ["ISSUED", "PENDING"] } } }),
    prisma.invoice.findMany({ where: { status: "OVERDUE" }, include: { provider: true } }),
    prisma.invoice.findMany({
      where: { dueDate: { gte: startOfDay, lte: in3Days }, status: { in: ["PENDING", "PARTIAL"] } },
      include: { provider: true },
    }),
    prisma.alert.findMany({ where: { severity: "CRITICAL", status: "OPEN" } }),
    getCfoRecommendations(),
  ]);

  return {
    date: startOfDay,
    availableToday: cashFlow.availableToday,
    depositsToday: depositsToday.reduce((s, d) => s + Number(d.amount), 0),
    paymentsToday: paymentsToday.reduce((s, p) => s + Number(p.amount), 0),
    checksClearedToday: checksClearedToday.length,
    checksPending: { count: checksPending.length, total: checksPending.reduce((s, c) => s + Number(c.amount), 0) },
    overdueInvoices: { count: overdueInvoices.length, total: overdueInvoices.reduce((s, i) => s + Number(i.total), 0), items: overdueInvoices },
    dueSoonInvoices: { count: dueSoonInvoices.length, items: dueSoonInvoices },
    financialRisks: criticalAlerts,
    recommendations,
    cashFlowProjection: cashFlow,
  };
}
