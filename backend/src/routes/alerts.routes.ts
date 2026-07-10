import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { auditAction } from "../middleware/auditLogger";
import { asyncHandler } from "../middleware/asyncHandler";

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

export default router;
