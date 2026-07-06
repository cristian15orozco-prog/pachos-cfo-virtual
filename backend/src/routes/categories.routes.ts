import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  const categories = await prisma.expenseCategory.findMany({ orderBy: { name: "asc" } });
  res.json({ data: categories });
});

export default router;
