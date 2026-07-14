import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { auditAction } from "../middleware/auditLogger";
import { asyncHandler } from "../middleware/asyncHandler";
import { ACCOUNT_LABEL, CashAccount, transferBetweenAccounts } from "../modules/cashflow/cashRegisterService";

const router = Router();

router.get(
  "/",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const { status = "OPEN" } = req.query;
    const alerts = await prisma.alert.findMany({
      where: { status: status as any },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });
    res.json({ data: alerts });
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN"),
  auditAction("ALERT_UPDATE", "alert"),
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status: "ACKNOWLEDGED" | "RESOLVED" };
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
    });
    res.json({ data: alert });
  })
);

/**
 * Resuelve una alerta de tipo AUTO_ALLOCATION_SHORTFALL (renta o pago de
 * trabajadores sin fondos suficientes). Si takeFromSavings es true, cubre el
 * faltante transfiriendo desde Ahorro; si es false, solo cierra la alerta —
 * el reparto automático lo vuelve a intentar solo la próxima vez que haya
 * fondos en Ventas del Día.
 */
router.post(
  "/:id/resolve-shortfall",
  requireRole(),
  auditAction("ALERT_RESOLVE_SHORTFALL", "alert"),
  asyncHandler(async (req, res) => {
    const { takeFromSavings } = req.body as { takeFromSavings?: boolean };
    const alert = await prisma.alert.findUniqueOrThrow({ where: { id: req.params.id } });

    if (alert.type !== "AUTO_ALLOCATION_SHORTFALL") {
      return res.status(400).json({ error: { code: "INVALID_ALERT", message: "Esta alerta no admite esta acción." } });
    }

    const meta = alert.metadata as { targetAccount: CashAccount; missingAmount: number };

    if (takeFromSavings) {
      await transferBetweenAccounts({
        fromAccount: "SAVINGS",
        toAccount: meta.targetAccount,
        amount: meta.missingAmount,
        notes: `Cobertura de faltante en ${ACCOUNT_LABEL[meta.targetAccount]} desde Ahorro`,
        createdById: req.auth!.userId,
      });
    }

    const resolved = await prisma.alert.update({
      where: { id: alert.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    res.json({ data: resolved });
  })
);

export default router;
