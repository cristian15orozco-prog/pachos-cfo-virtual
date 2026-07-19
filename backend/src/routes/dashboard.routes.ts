import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { computeCashFlowProjection } from "../modules/cashflow/cashFlowService";
import { getAllAccountBalances } from "../modules/cashflow/cashRegisterService";

const router = Router();

/** Resumen para el Dashboard del Dueño. Ver docs/ARCHITECTURE.md módulo 1. */
router.get(
  "/",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const [cashFlow, cashAccounts, pendingInvoices, overdueInvoices, checksIssued, checksCleared, checksPendingAgg, openAlerts] =
      await Promise.all([
        computeCashFlowProjection(),
        getAllAccountBalances(),
        prisma.invoice.findMany({ where: { status: { in: ["PENDING", "PARTIAL"] } } }),
        prisma.invoice.findMany({ where: { status: "OVERDUE" } }),
        prisma.check.count({ where: { status: "ISSUED" } }),
        prisma.check.count({ where: { status: "CLEARED" } }),
        prisma.check.aggregate({
          where: { status: { in: ["ISSUED", "PENDING"] } },
          _count: { _all: true },
          _sum: { amount: true },
        }),
        prisma.alert.findMany({ where: { status: "OPEN" }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }], take: 20 }),
      ]);

    const upcomingInvoices = await prisma.invoice.findMany({
      where: { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
      include: { provider: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    });

    res.json({
      data: {
        bankBalance: cashFlow.availableToday - cashFlow.cashOnHand,
        cashOnHand: cashFlow.cashOnHand,
        cashAccounts,
        pendingInvoices: { count: pendingInvoices.length, total: pendingInvoices.reduce((s, i) => s + Number(i.total), 0) },
        overdueInvoices: { count: overdueInvoices.length, total: overdueInvoices.reduce((s, i) => s + Number(i.total), 0) },
        checksIssued,
        checksCleared,
        checksPending: {
          count: checksPendingAgg._count._all,
          total: Number(checksPendingAgg._sum.amount ?? 0),
        },
        upcomingPayments: upcomingInvoices,
        cashFlowProjection: cashFlow.projections,
        alerts: openAlerts,
      },
    });
  })
);

export default router;
