import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.get(
  "/",
  requireRole(),
  asyncHandler(async (req, res) => {
    const { userId, action } = req.query;
    const logs = await prisma.auditLog.findMany({
      where: {
        userId: userId ? String(userId) : undefined,
        action: action ? String(action) : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json({ data: logs });
  })
);

export default router;
