import { prisma } from "../../lib/prisma";
import { getSettings, markPayrollWeekAllocated } from "../settings/businessSettingsService";
import { ACCOUNT_LABEL, CashAccount, getAccountBalance, transferBetweenAccounts } from "./cashRegisterService";

async function getSystemActorId(): Promise<string> {
  const owner = await prisma.user.findFirst({ where: { role: { name: "OWNER" } }, orderBy: { createdAt: "asc" } });
  if (!owner) throw new Error("No hay un usuario Dueño configurado para atribuir el movimiento automático.");
  return owner.id;
}

/**
 * Crea una alerta accionable ("¿tomarlo de Ahorro?") cuando el reparto
 * automático no se pudo cubrir con lo que hay en Ventas del Día. Evita
 * duplicados: si ya hay una alerta abierta para esa cuenta, no crea otra.
 */
async function createShortfallAlert(params: { targetAccount: CashAccount; missingAmount: number }) {
  const existing = await prisma.alert.findFirst({
    where: { type: "AUTO_ALLOCATION_SHORTFALL", status: "OPEN", entityType: params.targetAccount },
  });
  if (existing) return existing;

  const label = ACCOUNT_LABEL[params.targetAccount];
  return prisma.alert.create({
    data: {
      type: "AUTO_ALLOCATION_SHORTFALL",
      severity: "WARNING",
      message: `Faltan $${params.missingAmount.toFixed(2)} para separar ${label}. ¿Tomarlo de Ahorro?`,
      entityType: params.targetAccount,
      metadata: { targetAccount: params.targetAccount, missingAmount: params.missingAmount },
    },
  });
}

function getMostRecentMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=domingo, 1=lunes, ...
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/**
 * Revisión idempotente del reparto semanal de pago de trabajadores — se
 * puede llamar tantas veces como se quiera (cron de los lunes, o cada vez
 * que alguien abre la app); solo actúa una vez por semana calendario.
 */
export async function ensureWeeklyPayrollAllocation(params: { createdById?: string }) {
  const settings = await getSettings();
  const currentMonday = getMostRecentMonday(new Date());

  if (settings.lastPayrollWeekStart && new Date(settings.lastPayrollWeekStart).getTime() >= currentMonday.getTime()) {
    return { ran: false };
  }

  const payrollAmount = Number(settings.weeklyPayrollAmount);
  if (payrollAmount > 0) {
    const available = await getAccountBalance("DAILY_SALES");
    if (available >= payrollAmount) {
      const actor = params.createdById ?? (await getSystemActorId());
      await transferBetweenAccounts({
        fromAccount: "DAILY_SALES",
        toAccount: "PAYROLL",
        amount: payrollAmount,
        notes: "Separación automática semanal de pago de trabajadores",
        createdById: actor,
      });
    } else {
      await createShortfallAlert({ targetAccount: "PAYROLL", missingAmount: payrollAmount });
    }
  }

  await markPayrollWeekAllocated(currentMonday);
  return { ran: true };
}
