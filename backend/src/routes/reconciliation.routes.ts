import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { auditAction } from "../middleware/auditLogger";
import { reconcileAllPending } from "../modules/reconciliation/reconciliationService";

const router = Router();

router.get("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const { status } = req.query;
  const reconciliations = await prisma.reconciliation.findMany({
    where: { status: status ? (status as any) : undefined },
    include: { bankTransaction: true, matchedCheck: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: reconciliations });
});

router.post("/run", requireRole("ADMIN"), auditAction("RECONCILIATION_RUN"), async (_req, res) => {
  const results = await reconcileAllPending();
  res.json({ data: results });
});

router.post("/:id/resolve", requireRole("ADMIN"), auditAction("RECONCILIATION_RESOLVE", "reconciliation"), async (req, res) => {
  const reconciliation = await prisma.reconciliation.update({
    where: { id: req.params.id },
    data: { status: "MATCHED", notes: req.body?.notes },
  });
  res.json({ data: reconciliation });
});

export default router;
