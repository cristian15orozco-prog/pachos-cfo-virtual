import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { generateDailyReport } from "../modules/reports/dailyReportService";
import { getCfoRecommendations } from "../modules/reports/cfoAdvisorService";

const router = Router();

router.get("/daily", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const date = req.query.date ? new Date(String(req.query.date)) : new Date();
  const report = await generateDailyReport(date);
  res.json({ data: report });
});

router.get("/daily/latest", requireRole("ADMIN", "ACCOUNTANT"), async (_req, res) => {
  const report = await generateDailyReport();
  res.json({ data: report });
});

export default router;
