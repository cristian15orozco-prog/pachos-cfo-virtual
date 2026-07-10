import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { generateDailyReport } from "../modules/reports/dailyReportService";

const router = Router();

router.get(
  "/daily",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    const report = await generateDailyReport(date);
    res.json({ data: report });
  })
);

router.get(
  "/daily/latest",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const report = await generateDailyReport();
    res.json({ data: report });
  })
);

export default router;
