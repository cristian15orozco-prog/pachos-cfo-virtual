import { prisma } from "../../lib/prisma";

/** Configuración es una fila única — se crea con los valores por defecto la primera vez que se pide. */
export async function getSettings() {
  const existing = await prisma.businessSettings.findFirst();
  if (existing) return existing;
  return prisma.businessSettings.create({ data: {} });
}

export async function updateSettings(params: { dailyRentAmount?: number; weeklyPayrollAmount?: number }) {
  const settings = await getSettings();
  return prisma.businessSettings.update({
    where: { id: settings.id },
    data: {
      dailyRentAmount: params.dailyRentAmount,
      weeklyPayrollAmount: params.weeklyPayrollAmount,
    },
  });
}

export async function markPayrollWeekAllocated(weekStart: Date) {
  const settings = await getSettings();
  return prisma.businessSettings.update({
    where: { id: settings.id },
    data: { lastPayrollWeekStart: weekStart },
  });
}
