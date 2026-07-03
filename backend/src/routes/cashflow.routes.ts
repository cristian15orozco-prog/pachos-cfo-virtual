import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { computeCashFlowProjection } from "../modules/cashflow/cashFlowService";

const router = Router();

router.get("/summary", requireRole("ADMIN", "ACCOUNTANT"), async (_req, res) => {
  const summary = await computeCashFlowProjection();
  res.json({ data: summary });
});

router.get("/projection", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const days = Number(req.query.days ?? 30);
  const summary = await computeCashFlowProjection();
  const projection = (summary.projections as Record<number, number>)[days] ?? null;
  res.json({ data: { days, projection } });
});

router.get("/history", requireRole("ADMIN", "ACCOUNTANT"), async (_req, res) => {
  const history = await prisma.cashFlowProjection.findMany({ orderBy: { snapshotDate: "desc" }, take: 90 });
  res.json({ data: history });
});

export default router;
