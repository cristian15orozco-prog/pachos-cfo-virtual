import { prisma } from "../../lib/prisma";
import { computeCashFlowProjection } from "../cashflow/cashFlowService";

/**
 * Recomendaciones basadas en reglas (no ejecuta ninguna acción, solo texto).
 * Ver docs/BUSINESS_RULES.md sección 7.
 */
export async function getCfoRecommendations(): Promise<string[]> {
  const recommendations: string[] = [];
  const cashFlow = await computeCashFlowProjection();

  if (cashFlow.projections[15] < 0) {
    recommendations.push("No emitas más cheques esta semana si quieres mantener caja positiva.");
  }

  const overdueSoonInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["PENDING", "PARTIAL"] },
      dueDate: { gt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
    },
  });
  if (overdueSoonInvoices.length > 0 && cashFlow.projections[7] < cashFlow.availableToday * 0.2) {
    recommendations.push("Es mejor esperar antes de pagar facturas que aún no vencen; el flujo de caja a 7 días está ajustado.");
  }

  const providersWithManyPending = await prisma.provider.findMany({
    where: { invoices: { some: { status: { in: ["PENDING", "PARTIAL"] } } } },
    include: { invoices: { where: { status: { in: ["PENDING", "PARTIAL"] } } } },
  });
  for (const provider of providersWithManyPending) {
    if (provider.invoices.length >= 3) {
      recommendations.push(`El proveedor "${provider.name}" tiene ${provider.invoices.length} facturas pendientes.`);
    }
  }

  const unclassifiedCharges = await prisma.alert.count({
    where: { type: "UNCLASSIFIED_CHARGE", status: "OPEN" },
  });
  if (unclassifiedCharges > 0) {
    recommendations.push(`Hay ${unclassifiedCharges} cargo(s) bancario(s) sin clasificar que deben revisarse.`);
  }

  const payableNow = await prisma.invoice.findMany({
    where: { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } },
  });
  const payableTotal = payableNow.reduce((sum, inv) => sum + Number(inv.total), 0);
  if (payableTotal > 0 && cashFlow.availableToday - payableTotal > 0) {
    recommendations.push(
      `Puedes pagar ${payableNow.length} factura(s) por un total de $${payableTotal.toFixed(2)} sin afectar negativamente el flujo de caja.`
    );
  }

  return recommendations;
}
