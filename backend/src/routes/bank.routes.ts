import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { auditAction, recordAudit } from "../middleware/auditLogger";
import {
  createLinkToken,
  exchangePublicToken,
  getAccountsBalance,
  syncTransactions,
  removeItem,
} from "../integrations/plaid/plaidClient";
import { encryptToken, decryptToken } from "../lib/tokenCrypto";
import { reconcileTransaction } from "../modules/reconciliation/reconciliationService";

/**
 * Rutas del banco (TD Bank vía Plaid) — SOLO LECTURA.
 * No existen, ni deben agregarse aquí, rutas de transferencia, pago o ACH.
 * Ver docs/SECURITY.md.
 */
const router = Router();

router.post("/link-token", requireRole(), auditAction("BANK_LINK_TOKEN_CREATE"), async (req, res) => {
  const data = await createLinkToken(req.auth!.userId);
  res.json({ data });
});

const exchangeSchema = z.object({ publicToken: z.string().min(1) });

router.post("/exchange-public-token", requireRole(), async (req, res) => {
  const parsed = exchangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });

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
  res.status(201).json({ data: { id: connection.id, institutionName: connection.institutionName, status: connection.status } });
});

router.get("/accounts", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const connection = await prisma.bankConnection.findFirst({ where: { status: "ACTIVE" } });
  if (!connection) return res.json({ data: [] });

  const accessToken = decryptToken(connection.accessTokenEncrypted);
  const accounts = await getAccountsBalance(accessToken);
  await recordAudit({ req, action: "VIEW_BALANCE", entityType: "bank_connection", entityId: connection.id });
  res.json({ data: accounts });
});

router.get("/transactions", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const transactions = await prisma.bankTransaction.findMany({
    orderBy: { transactionDate: "desc" },
    take: 200,
  });
  res.json({ data: transactions });
});

router.post("/sync", requireRole(), auditAction("BANK_SYNC", "bank_connection"), async (req, res) => {
  const connection = await prisma.bankConnection.findFirst({ where: { status: "ACTIVE" } });
  if (!connection) return res.status(404).json({ error: { code: "NO_BANK_CONNECTION", message: "No hay banco conectado" } });

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
});

router.delete("/connection/:id", requireRole(), auditAction("BANK_DISCONNECTED", "bank_connection"), async (req, res) => {
  const connection = await prisma.bankConnection.findUniqueOrThrow({ where: { id: req.params.id } });
  await removeItem(decryptToken(connection.accessTokenEncrypted));
  await prisma.bankConnection.update({ where: { id: connection.id }, data: { status: "DISCONNECTED" } });
  res.status(204).send();
});

export default router;
