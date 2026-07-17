import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/requireRole";
import { auditAction } from "../middleware/auditLogger";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  CASH_ACCOUNTS,
  ACCOUNT_LABEL,
  getAllAccountBalances,
  getCashOnHand,
  recordCashMovement,
  transferBetweenAccounts,
} from "../modules/cashflow/cashRegisterService";
import { splitDailyRent, ensureWeeklyPayrollAllocation } from "../modules/cashflow/autoAllocationService";
import { prisma } from "../lib/prisma";

const router = Router();

router.get(
  "/",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    await ensureWeeklyPayrollAllocation({ createdById: req.auth!.userId });
    const [balance, accounts] = await Promise.all([getCashOnHand(), getAllAccountBalances()]);
    res.json({ data: { balance, accounts } });
  })
);

router.get(
  "/accounts",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    res.json({ data: CASH_ACCOUNTS.map((id) => ({ id, label: ACCOUNT_LABEL[id] })) });
  })
);

const accountQuerySchema = z.enum(CASH_ACCOUNTS);

router.get(
  "/movements",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const parsedAccount = accountQuerySchema.safeParse(req.query.account);
    const movements = await prisma.cashMovement.findMany({
      where: parsedAccount.success ? { account: parsedAccount.data } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { invoice: { include: { provider: true } } },
    });
    res.json({ data: movements });
  })
);

const adjustSchema = z.object({
  account: z.enum(CASH_ACCOUNTS),
  type: z.enum(["DEPOSIT", "WITHDRAWAL"]),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

router.post(
  "/adjust",
  requireRole(),
  auditAction("CASH_REGISTER_ADJUST", "cash_movement"),
  asyncHandler(async (req, res) => {
    const parsed = adjustSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });

    const movement = await recordCashMovement({
      account: parsed.data.account,
      type: parsed.data.type,
      amount: parsed.data.amount,
      notes: parsed.data.notes,
      createdById: req.auth!.userId,
    });
    res.status(201).json({ data: movement });
  })
);

const dailySaleSchema = z.object({
  amount: z.number().positive(),
  notes: z.string().optional(),
});

/**
 * Registra la venta en efectivo del día en Ventas del Día y dispara el
 * reparto automático de renta (y, de paso, revisa si toca el de planilla
 * semanal) — ver docs/BUSINESS_RULES.md. Si no alcanza para separar la
 * renta, no bloquea la venta: queda una alerta pendiente.
 */
router.post(
  "/daily-sale",
  requireRole("ADMIN", "EMPLOYEE"),
  auditAction("CASH_DAILY_SALE", "cash_movement"),
  asyncHandler(async (req, res) => {
    const parsed = dailySaleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });

    const deposit = await recordCashMovement({
      account: "DAILY_SALES",
      type: "DEPOSIT",
      amount: parsed.data.amount,
      notes: parsed.data.notes ?? "Venta en efectivo del día",
      createdById: req.auth!.userId,
    });

    const rentSplit = await splitDailyRent({ createdById: req.auth!.userId });
    await ensureWeeklyPayrollAllocation({ createdById: req.auth!.userId });

    // Una cajera puede agregar la venta, pero no puede ver ningún saldo.
    const isEmployee = req.auth!.role === "EMPLOYEE";
    if (isEmployee) {
      return res.status(201).json({ data: { registered: true } });
    }
    res.status(201).json({ data: { deposit, rentSplit } });
  })
);

const transferSchema = z.object({
  fromAccount: z.enum(CASH_ACCOUNTS),
  toAccount: z.enum(CASH_ACCOUNTS),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

router.post(
  "/transfer",
  requireRole(),
  auditAction("CASH_REGISTER_TRANSFER", "cash_movement"),
  asyncHandler(async (req, res) => {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });

    const result = await transferBetweenAccounts({
      fromAccount: parsed.data.fromAccount,
      toAccount: parsed.data.toAccount,
      amount: parsed.data.amount,
      notes: parsed.data.notes,
      createdById: req.auth!.userId,
    });
    res.status(201).json({ data: result });
  })
);

export default router;
