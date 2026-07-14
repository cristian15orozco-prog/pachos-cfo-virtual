import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/requireRole";
import { auditAction } from "../middleware/auditLogger";
import { asyncHandler } from "../middleware/asyncHandler";
import { getSettings, updateSettings } from "../modules/settings/businessSettingsService";

const router = Router();

router.get(
  "/",
  requireRole(),
  asyncHandler(async (_req, res) => {
    res.json({ data: await getSettings() });
  })
);

const updateSchema = z.object({
  dailyRentAmount: z.number().nonnegative().optional(),
  weeklyPayrollAmount: z.number().nonnegative().optional(),
});

router.patch(
  "/",
  requireRole(),
  auditAction("BUSINESS_SETTINGS_UPDATE", "business_settings"),
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
    res.json({ data: await updateSettings(parsed.data) });
  })
);

export default router;
