import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { auditAction } from "../middleware/auditLogger";

const router = Router();

router.get("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const { status } = req.query;
  const checks = await prisma.check.findMany({
    where: { status: status ? (status as any) : undefined },
    include: { invoice: { include: { provider: true } } },
    orderBy: { issueDate: "desc" },
  });
  res.json({ data: checks });
});

router.get("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const check = await prisma.check.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { invoice: true, attachments: true },
  });
  res.json({ data: check });
});

const checkSchema = z.object({
  checkNumber: z.string().min(1),
  issueDate: z.coerce.date(),
  payee: z.string().min(1),
  bankName: z.string().default("TD Bank"),
  amount: z.number().positive(),
  invoiceId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

// Nota: esto REGISTRA un cheque que el dueño ya emitió manualmente en su chequera
// física. El sistema no imprime, no genera ni envía cheques.
router.post("/", requireRole("ADMIN"), auditAction("CHECK_CREATE", "check"), async (req, res) => {
  const parsed = checkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  const check = await prisma.check.create({
    data: { ...parsed.data, status: "ISSUED", createdById: req.auth!.userId },
  });
  res.status(201).json({ data: check });
});

router.patch("/:id", requireRole("ADMIN"), auditAction("CHECK_UPDATE", "check"), async (req, res) => {
  const parsed = checkSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  const check = await prisma.check.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ data: check });
});

router.post("/:id/mark-cleared", requireRole("ADMIN"), auditAction("CHECK_MARK_CLEARED", "check"), async (req, res) => {
  const check = await prisma.check.update({
    where: { id: req.params.id },
    data: { status: "CLEARED", clearedAt: new Date() },
  });
  res.json({ data: check });
});

export default router;
