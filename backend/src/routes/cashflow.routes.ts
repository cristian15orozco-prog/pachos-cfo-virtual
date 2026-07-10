import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { computeCashFlowProjection } from "../modules/cashflow/cashFlowService";

const router = Router();

router.get(
  "/summary",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const summary = await computeCashFlowProjection();
    res.json({ data: summary });
  })
);

router.get(
  "/projection",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days ?? 30);
    const summary = await computeCashFlowProjection();
    const projection = (summary.projections as Record<number, number>)[days] ?? null;
    res.json({ data: { days, projection } });
  })
);

router.get(
  "/history",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const history = await prisma.cashFlowProjection.findMany({ orderBy: { snapshotDate: "desc" }, take: 90 });
    res.json({ data: history });
  })
);

/**
 * Línea de tiempo combinada: movimientos de efectivo (registrados a mano) +
 * transacciones bancarias (sincronizadas de solo lectura vía Plaid).
 * Solo lectura — no representa ni permite ninguna acción sobre el dinero.
 */
router.get(
  "/timeline",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const [cashMovements, bankTransactions] = await Promise.all([
      prisma.cashMovement.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { invoice: { include: { provider: true } } },
      }),
      prisma.bankTransaction.findMany({ orderBy: { transactionDate: "desc" }, take: 100 }),
    ]);

    const cashEntries = cashMovements.map((m) => ({
      id: m.id,
      source: "CASH" as const,
      date: m.createdAt,
      description:
        m.notes ??
        (m.type === "PAYMENT" && m.invoice
          ? `Pago de factura ${m.invoice.invoiceNumber} (${m.invoice.provider.name})`
          : m.type === "DEPOSIT"
            ? "Depósito de efectivo"
            : "Retiro de efectivo"),
      type: m.type,
      amount: m.type === "DEPOSIT" ? Number(m.amount) : -Number(m.amount),
      balanceAfter: Number(m.balanceAfter),
    }));

    const bankEntries = bankTransactions.map((t) => ({
      id: t.id,
      source: "BANK" as const,
      date: t.transactionDate,
      description: t.description ?? t.category ?? "Transacción bancaria",
      type: t.type,
      amount: t.type === "DEPOSIT" ? Math.abs(Number(t.amount)) : -Math.abs(Number(t.amount)),
      balanceAfter: null as number | null,
    }));

    const timeline = [...cashEntries, ...bankEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    res.json({ data: timeline });
  })
);

export default router;
