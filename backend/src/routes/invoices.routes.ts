import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { auditAction } from "../middleware/auditLogger";
import {
  findPossibleDuplicates,
  findInvoicesWithoutReceipt,
  findOverdueInvoices,
  findAmountMismatches,
} from "../modules/invoices/invoiceDetectionService";

const router = Router();

router.get("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const { status, providerId } = req.query;
  const invoices = await prisma.invoice.findMany({
    where: {
      status: status ? (status as any) : undefined,
      providerId: providerId ? String(providerId) : undefined,
    },
    include: { provider: true, category: true, attachments: true },
    orderBy: { dueDate: "asc" },
  });
  res.json({ data: invoices });
});

router.get("/alerts/duplicates", requireRole("ADMIN"), async (_req, res) => {
  const invoices = await prisma.invoice.findMany({ where: { isDuplicateFlag: true }, include: { provider: true } });
  res.json({ data: invoices });
});

router.get("/alerts/overdue", requireRole("ADMIN"), async (_req, res) => {
  res.json({ data: await findOverdueInvoices() });
});

router.get("/alerts/missing-receipt", requireRole("ADMIN"), async (_req, res) => {
  res.json({ data: await findInvoicesWithoutReceipt() });
});

router.get("/alerts/amount-mismatches", requireRole("ADMIN"), async (_req, res) => {
  res.json({ data: await findAmountMismatches() });
});

router.get("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { provider: true, category: true, attachments: true, payments: true },
  });
  res.json({ data: invoice });
});

const invoiceSchema = z.object({
  providerId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  categoryId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

router.post("/", requireRole("ADMIN"), auditAction("INVOICE_CREATE", "invoice"), async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });

  const duplicates = await findPossibleDuplicates(parsed.data);
  const invoice = await prisma.invoice.create({
    data: { ...parsed.data, createdById: req.auth!.userId, isDuplicateFlag: duplicates.length > 0 },
  });

  if (duplicates.length > 0) {
    await prisma.alert.create({
      data: {
        type: "INVOICE_DUPLICATE",
        severity: "WARNING",
        message: "Este proveedor tiene una factura duplicada.",
        entityType: "invoice",
        invoiceId: invoice.id,
      },
    });
  }

  res.status(201).json({ data: invoice, possibleDuplicates: duplicates });
});

router.patch("/:id", requireRole("ADMIN"), auditAction("INVOICE_UPDATE", "invoice"), async (req, res) => {
  const parsed = invoiceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });
  const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ data: invoice });
});

router.delete("/:id", requireRole(), auditAction("INVOICE_DELETE", "invoice"), async (req, res) => {
  await prisma.invoice.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
