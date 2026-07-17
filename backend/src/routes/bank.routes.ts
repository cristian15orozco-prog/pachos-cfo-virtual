import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { auditAction, recordAudit } from "../middleware/auditLogger";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  createLinkToken,
  exchangePublicToken,
  getAccountsBalance,
  syncTransactions,
  removeItem,
} from "../integrations/plaid/plaidClient";
import { encryptToken, decryptToken } from "../lib/tokenCrypto";
import { reconcileTransaction } from "../modules/reconciliation/reconciliationService";
import { getManualBankBalance, recordBankMovement } from "../modules/cashflow/bankRegisterService";

/**
 * Rutas del banco (TD Bank vía Plaid) — SOLO LECTURA.
 * No existen, ni deben agregarse aquí, rutas de transferencia, pago o ACH.
 * Ver docs/SECURITY.md.
 */
const router = Router();

router.post(
  "/link-token",
  requireRole(),
  auditAction("BANK_LINK_TOKEN_CREATE"),
  asyncHandler(async (req, res) => {
    const data = await createLinkToken(req.auth!.userId);
    res.json({ data });
  })
);

const exchangeSchema = z.object({ publicToken: z.string().min(1) });

router.post(
  "/exchange-public-token",
  requireRole(),
  asyncHandler(async (req, res) => {
    const parsed = exchangeSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });

    const { access_token, item_id } = await exchangePublicToken(parsed.data.publicToken);

    const connection = await prisma.bankConnection.create({
      data: {
        institutionName: "TD Bank",
        plaidItemId: item_id,
        accessTokenEncrypted: encryptToken(access_token),
        status: "ACTIVE",
        createdById: req.auth!.userId,
      },
    });

    await recordAudit({ req, action: "BANK_CONNECTED", entityType: "bank_connection", entityId: connection.id });
    res
      .status(201)
      .json({ data: { id: connection.id, institutionName: connection.institutionName, status: connection.status } });
  })
);

router.get(
  "/accounts",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (req, res) => {
    const connection = await prisma.bankConnection.findFirst({ where: { status: "ACTIVE" } });
    if (!connection) {
      const manualBalance = await getManualBankBalance();
      return res.json({
        data: [
          {
            account_id: "manual",
            name: "TD Bank (saldo manual)",
            balances: { available: manualBalance, current: manualBalance },
          },
        ],
        isManual: true,
      });
    }

    const accessToken = decryptToken(connection.accessTokenEncrypted);
    const accounts = await getAccountsBalance(accessToken);
    await recordAudit({ req, action: "VIEW_BALANCE", entityType: "bank_connection", entityId: connection.id });
    res.json({ data: accounts, isManual: false });
  })
);

/** Saldo manual de banco — solo relevante mientras no haya Plaid conectado. */
router.get(
  "/manual-balance",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const balance = await getManualBankBalance();
    res.json({ data: { balance } });
  })
);

router.get(
  "/manual-balance/movements",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const movements = await prisma.bankMovement.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    res.json({ data: movements });
  })
);

const manualAdjustSchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAWAL"]),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

router.post(
  "/manual-balance/adjust",
  requireRole("ADMIN", "EMPLOYEE"),
  auditAction("BANK_MANUAL_BALANCE_ADJUST", "bank_movement"),
  asyncHandler(async (req, res) => {
    const parsed = manualAdjustSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });

    // Una cajera solo puede agregar ventas en tarjeta (depósitos) — retiros y
    // correcciones de saldo quedan reservados a Dueño/Administrador.
    const isEmployee = req.auth!.role === "EMPLOYEE";
    if (isEmployee && parsed.data.type !== "DEPOSIT") {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Solo puedes agregar depósitos (venta en tarjeta), no retiros." },
      });
    }

    const movement = await recordBankMovement({
      type: parsed.data.type,
      amount: parsed.data.amount,
      notes: parsed.data.notes,
      createdById: req.auth!.userId,
    });

    // Una cajera puede agregar la venta, pero no puede ver el saldo del banco.
    const { balanceAfter, ...movementWithoutBalance } = movement;
    res.status(201).json({ data: isEmployee ? movementWithoutBalance : movement });
  })
);

router.get(
  "/transactions",
  requireRole("ADMIN", "ACCOUNTANT"),
  asyncHandler(async (_req, res) => {
    const transactions = await prisma.bankTransaction.findMany({
      orderBy: { transactionDate: "desc" },
      take: 200,
    });
    res.json({ data: transactions });
  })
);

router.post(
  "/sync",
  requireRole(),
  auditAction("BANK_SYNC", "bank_connection"),
  asyncHandler(async (_req, res) => {
    const connection = await prisma.bankConnection.findFirst({ where: { status: "ACTIVE" } });
    if (!connection)
      return res.status(404).json({ error: { code: "NO_BANK_CONNECTION", message: "No hay banco conectado" } });

    const accessToken = decryptToken(connection.accessTokenEncrypted);
    const result = await syncTransactions(accessToken);

    const created = [];
    for (const tx of result.added) {
      const saved = await prisma.bankTransaction.upsert({
        where: { plaidTransactionId: tx.transaction_id },
        update: {},
        create: {
          bankConnectionId: connection.id,
          plaidTransactionId: tx.transaction_id,
          accountId: tx.account_id,
          amount: tx.amount,
          type: tx.amount < 0 ? "DEPOSIT" : "WITHDRAWAL",
          description: tx.name,
          category: tx.personal_finance_category?.primary,
          transactionDate: new Date(tx.date),
        },
      });
      created.push(saved);
      await reconcileTransaction(saved.id);
    }

    await prisma.bankConnection.update({ where: { id: connection.id }, data: { lastSyncedAt: new Date() } });
    res.json({ data: { syncedCount: created.length } });
  })
);

router.delete(
  "/connection/:id",
  requireRole(),
  auditAction("BANK_DISCONNECTED", "bank_connection"),
  asyncHandler(async (req, res) => {
    const connection = await prisma.bankConnection.findUniqueOrThrow({ where: { id: req.params.id } });
    await removeItem(decryptToken(connection.accessTokenEncrypted));
    await prisma.bankConnection.update({ where: { id: connection.id }, data: { status: "DISCONNECTED" } });
    res.status(204).send();
  })
);

export default router;
