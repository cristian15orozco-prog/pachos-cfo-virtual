import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { getCfoRecommendations } from "../modules/reports/cfoAdvisorService";

const router = Router();

router.get("/recommendations", requireRole("ADMIN", "ACCOUNTANT"), async (_req, res) => {
  const recommendations = await getCfoRecommendations();
  res.json({ data: recommendations });
});

export default router;
