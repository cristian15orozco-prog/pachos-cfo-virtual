import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { getCfoRecommendations } from "../modules/reports/cfoAdvisorService";

const router = Router();

router.get(
  "/recommendations",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const recommendations = await getCfoRecommendations();
    res.json({ data: recommendations });
  })
);

export default router;
