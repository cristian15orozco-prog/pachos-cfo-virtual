import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { decryptToken } from "../lib/tokenCrypto";
import { syncTransactions } from "../integrations/plaid/plaidClient";
import { reconcileTransaction } from "../modules/reconciliation/reconciliationService";
import { computeCashFlowProjection } from "../modules/cashflow/cashFlowService";

/**
 * Job diario: sincroniza transacciones bancarias (solo lectura), concilia,
 * y recalcula el flujo de caja proyectado. Corre a las 6:00 AM hora del servidor.
 */
export function scheduleDailySync() {
  cron.schedule("0 6 * * *", async () => {
    const connection = await prisma.bankConnection.findFirst({ where: { status: "ACTIVE" } });
    if (!connection) return;

    const accessToken = decryptToken(connection.accessTokenEncrypted);
    const result = await syncTransactions(accessToken);

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
      await reconcileTransaction(saved.id);
    }

    await prisma.bankConnection.update({ where: { id: connection.id }, data: { lastSyncedAt: new Date() } });
    await computeCashFlowProjection();
  });
}
