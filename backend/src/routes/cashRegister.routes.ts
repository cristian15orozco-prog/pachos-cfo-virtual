import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/requireRole";
import { auditAction } from "../middleware/auditLogger";
import { asyncHandler } from "../middleware/asyncHandler";
import { getCashOnHand, recordCashMovement } from "../modules/cashflow/cashRegisterService";
import { prisma } from "../lib/prisma";

const router = Router();

router.get(
  "/",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const balance = await getCashOnHand();
    res.json({ data: { balance } });
  })
);

router.get(
  "/movements",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const movements = await prisma.cashMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { invoice: { include: { provider: true } } },
    });
    res.json({ data: movements });
  })
);

const adjustSchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAWAL"]),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

router.post(
  "/adjust",
  requireRole(),
  auditAction("CASH_REGISTER_ADJUST", "cash_movement"),
  asyncHandler(async (req, res) => {
    const parsed = adjustSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });

    const movement = await recordCashMovement({
      type: parsed.data.type,
      amount: parsed.data.amount,
      notes: parsed.data.notes,
      createdById: req.auth!.userId,
    });
    res.status(201).json({ data: movement });
  })
);

export default router;
