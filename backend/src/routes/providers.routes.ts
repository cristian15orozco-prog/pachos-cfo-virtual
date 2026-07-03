import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { auditAction } from "../middleware/auditLogger";

const router = Router();

router.get("/", requireRole("ADMIN", "ACCOUNTANT"), async (_req, res) => {
  const providers = await prisma.provider.findMany({ orderBy: { name: "asc" } });
  const withStats = await Promise.all(
    providers.map(async (provider) => {
      const invoices = await prisma.invoice.findMany({ where: { providerId: provider.id } });
      const pendingBalance = invoices
        .filter((i) => i.status !== "PAID")
        .reduce((sum, i) => sum + Number(i.total), 0);
      return { ...provider, invoiceCount: invoices.length, pendingBalance };
    })
  );
  res.json({ data: withStats });
});

router.get("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const provider = await prisma.provider.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { invoices: { orderBy: { invoiceDate: "desc" } } },
  });
  res.json({ data: provider });
});

const providerSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/", requireRole("ADMIN"), auditAction("PROVIDER_CREATE", "provider"), async (req, res) => {
  const parsed = providerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  const provider = await prisma.provider.create({ data: parsed.data });
  res.status(201).json({ data: provider });
});

router.patch("/:id", requireRole("ADMIN"), auditAction("PROVIDER_UPDATE", "provider"), async (req, res) => {
  const parsed = providerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  const provider = await prisma.provider.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ data: provider });
});

router.delete("/:id", requireRole(), auditAction("PROVIDER_DEACTIVATE", "provider"), async (req, res) => {
  const provider = await prisma.provider.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ data: provider });
});

export default router;
