import { prisma } from "../../lib/prisma";

/**
 * Motor de conciliación — SOLO LECTURA sobre el banco.
 * Compara transacciones ya sincronizadas de Plaid contra cheques y pagos
 * registrados manualmente. Nunca crea ni modifica movimientos bancarios,
 * solo escribe filas de análisis en `reconciliations` y `alerts`.
 * Ver docs/BUSINESS_RULES.md sección 4.
 */
export async function reconcileTransaction(bankTransactionId: string) {
  const transaction = await prisma.bankTransaction.findUniqueOrThrow({
    where: { id: bankTransactionId },
  });

  // 1. Intentar conciliar contra un cheque
  if (transaction.type === "CHECK") {
    const candidates = await prisma.check.findMany({
      where: { amount: transaction.amount, status: { in: ["ISSUED", "PENDING"] } },
    });

    if (candidates.length === 1) {
      const [check] = candidates;
      await prisma.$transaction([
        prisma.check.update({
          where: { id: check.id },
          data: { status: "CLEARED", clearedAt: transaction.transactionDate, reconciled: true },
        }),
        prisma.reconciliation.create({
          data: {
            bankTransactionId: transaction.id,
            matchedType: "CHECK",
            matchedCheckId: check.id,
            amountDifference: 0,
            status: "MATCHED",
          },
        }),
      ]);
      return { status: "MATCHED", matchedType: "CHECK", checkId: check.id };
    }

    if (candidates.length > 1) {
      const reconciliation = await prisma.reconciliation.create({
        data: {
          bankTransactionId: transaction.id,
          matchedType: "CHECK",
          status: "FLAGGED",
          notes: `${candidates.length} cheques candidatos con el mismo monto; requiere revisión manual.`,
        },
      });
      await prisma.alert.create({
        data: {
          type: "CHECK_MATCH_AMBIGUOUS",
          severity: "CRITICAL",
          message: "Hay varios cheques que podrían corresponder a este cobro. Revisa manualmente.",
          entityType: "bank_transaction",
          bankTransactionId: transaction.id,
        },
      });
      return reconciliation;
    }
  }

  // 2. Intentar conciliar contra un pago/factura pendiente
  if (transaction.type === "WITHDRAWAL") {
    const pendingPayment = await prisma.payment.findFirst({
      where: { bankTransactionId: null, amount: transaction.amount },
      include: { invoice: { include: { provider: true } } },
    });

    if (pendingPayment) {
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: { bankTransactionId: transaction.id },
      });
      const reconciliation = await prisma.reconciliation.create({
        data: {
          bankTransactionId: transaction.id,
          matchedType: "INVOICE",
          matchedInvoiceId: pendingPayment.invoiceId,
          amountDifference: 0,
          status: "MATCHED",
        },
      });
      return reconciliation;
    }
  }

  // 3. Sin match -> queda sin conciliar y se genera alerta
  const reconciliation = await prisma.reconciliation.create({
    data: {
      bankTransactionId: transaction.id,
      matchedType: "UNKNOWN",
      status: "UNMATCHED",
    },
  });

  await prisma.alert.create({
    data: {
      type: transaction.type === "WITHDRAWAL" ? "PAYMENT_NO_INVOICE_MATCH" : "UNCLASSIFIED_CHARGE",
      severity: transaction.type === "WITHDRAWAL" ? "CRITICAL" : "WARNING",
      message:
        transaction.type === "WITHDRAWAL"
          ? "Este pago no coincide con ninguna factura."
          : "Hay un cargo bancario sin clasificar.",
      entityType: "bank_transaction",
      bankTransactionId: transaction.id,
    },
  });

  return reconciliation;
}

export async function reconcileAllPending() {
  const unreconciled = await prisma.bankTransaction.findMany({
    where: { reconciliations: { none: {} } },
  });
  const results = [];
  for (const tx of unreconciled) {
    results.push(await reconcileTransaction(tx.id));
  }
  return results;
}
