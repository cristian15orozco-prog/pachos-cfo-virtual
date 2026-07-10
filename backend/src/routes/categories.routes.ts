import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.expenseCategory.findMany({ orderBy: { name: "asc" } });
    res.json({ data: categories });
  })
);

export default router;
