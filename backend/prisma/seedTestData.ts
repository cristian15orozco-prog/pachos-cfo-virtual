// Datos de prueba: proveedores, facturas y cheques realistas para Pachos Supermarket.
// Ejecutar con: npm run prisma:seed:test-data
// Seguro de correr varias veces (usa upsert / findFirst-or-create donde aplica).
import { PrismaClient, RoleName } from "@prisma/client";
import { findPossibleDuplicates } from "../src/modules/invoices/invoiceDetectionService";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromNow(n: number): Date {
  return daysAgo(-n);
}

async function upsertCategory(name: string) {
  return prisma.expenseCategory.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function upsertProvider(data: {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  category: string;
}) {
  const existing = await prisma.provider.findFirst({ where: { name: data.name } });
  if (existing) return existing;
  return prisma.provider.create({ data });
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: { name: RoleName.OWNER } } });

  const categories = {
    bebidas: await upsertCategory("Bebidas"),
    carniceria: await upsertCategory("Carnicería"),
    frutasVerduras: await upsertCategory("Frutas y Verduras"),
    panaderia: await upsertCategory("Panadería"),
    limpieza: await upsertCategory("Limpieza"),
    lacteos: await upsertCategory("Lácteos"),
  };

  const distribuidora = await upsertProvider({
    name: "Distribuidora La Central",
    contactName: "Carlos Méndez",
    phone: "(305) 555-0142",
    email: "ventas@lacentraldist.com",
    address: "1420 NW 79th Ave, Miami, FL",
    category: "Bebidas",
  });
  const carnes = await upsertProvider({
    name: "Carnes Selectas del Valle",
    contactName: "Miguel Ángel Rojas",
    phone: "(305) 555-0198",
    email: "pedidos@carnesselectas.com",
    address: "880 SW 27th Ave, Miami, FL",
    category: "Carnicería",
  });
  const frutasVerduras = await upsertProvider({
    name: "Frutas y Verduras Don José",
    contactName: "José Ramírez",
    phone: "(786) 555-0173",
    email: "donjose.produce@gmail.com",
    address: "212 NW 22nd St, Miami, FL",
    category: "Frutas y Verduras",
  });
  const panaderia = await upsertProvider({
    name: "Panadería El Trigal",
    contactName: "Ana Belén Torres",
    phone: "(305) 555-0110",
    email: "ana@eltrigalbakery.com",
    address: "3355 SW 8th St, Miami, FL",
    category: "Panadería",
  });
  const proclean = await upsertProvider({
    name: "ProClean Suministros",
    contactName: "Roberto Salinas",
    phone: "(786) 555-0166",
    email: "roberto@procleansuministros.com",
    address: "990 NW 36th St, Miami, FL",
    category: "Limpieza",
  });
  const lacteos = await upsertProvider({
    name: "Lácteos La Vaquita",
    contactName: "Marta Fuentes",
    phone: "(305) 555-0187",
    email: "marta@lavaquitadairy.com",
    address: "4501 NW 74th Ave, Miami, FL",
    category: "Lácteos",
  });

  type InvoiceSeed = {
    providerId: string;
    invoiceNumber: string;
    invoiceDate: Date;
    dueDate: Date;
    subtotal: number;
    tax: number;
    total: number;
    categoryId: string;
    notes?: string;
  };

  const invoiceSeeds: InvoiceSeed[] = [
    {
      providerId: distribuidora.id,
      invoiceNumber: "INV-1001",
      invoiceDate: daysAgo(20),
      dueDate: daysAgo(5),
      subtotal: 2500,
      tax: 375,
      total: 2875,
      categoryId: categories.bebidas.id,
    },
    {
      providerId: distribuidora.id,
      invoiceNumber: "INV-1002",
      invoiceDate: daysAgo(5),
      dueDate: daysFromNow(10),
      subtotal: 1800,
      tax: 270,
      total: 2070,
      categoryId: categories.bebidas.id,
    },
    {
      providerId: carnes.id,
      invoiceNumber: "INV-3341",
      invoiceDate: daysAgo(15),
      dueDate: daysAgo(2),
      subtotal: 3800,
      tax: 400,
      total: 4200,
      categoryId: categories.carniceria.id,
    },
    {
      // Duplicado intencional: mismo proveedor y monto que INV-3341, fecha dentro de la ventana de +/-3 días.
      providerId: carnes.id,
      invoiceNumber: "INV-3343",
      invoiceDate: daysAgo(14),
      dueDate: daysAgo(1),
      subtotal: 3800,
      tax: 400,
      total: 4200,
      categoryId: categories.carniceria.id,
      notes: "Revisar: podría ser un duplicado de INV-3341.",
    },
    {
      providerId: frutasVerduras.id,
      invoiceNumber: "INV-778",
      invoiceDate: daysAgo(3),
      dueDate: daysFromNow(1),
      subtotal: 880,
      tax: 70,
      total: 950,
      categoryId: categories.frutasVerduras.id,
    },
    {
      providerId: panaderia.id,
      invoiceNumber: "INV-221",
      invoiceDate: daysAgo(10),
      dueDate: daysAgo(1),
      subtotal: 1120,
      tax: 80,
      total: 1200,
      categoryId: categories.panaderia.id,
    },
    {
      providerId: panaderia.id,
      invoiceNumber: "INV-222",
      invoiceDate: daysAgo(8),
      dueDate: daysAgo(3),
      subtotal: 750,
      tax: 50,
      total: 800,
      categoryId: categories.panaderia.id,
    },
    {
      providerId: proclean.id,
      invoiceNumber: "INV-55",
      invoiceDate: daysAgo(2),
      dueDate: daysFromNow(20),
      subtotal: 590,
      tax: 40,
      total: 630,
      categoryId: categories.limpieza.id,
    },
    {
      providerId: lacteos.id,
      invoiceNumber: "INV-90",
      invoiceDate: daysAgo(1),
      dueDate: daysFromNow(15),
      subtotal: 1350,
      tax: 100,
      total: 1450,
      categoryId: categories.lacteos.id,
    },
  ];

  const invoicesByNumber: Record<string, { id: string; total: number }> = {};

  for (const seed of invoiceSeeds) {
    const existing = await prisma.invoice.findFirst({
      where: { providerId: seed.providerId, invoiceNumber: seed.invoiceNumber },
    });
    if (existing) {
      invoicesByNumber[seed.invoiceNumber] = { id: existing.id, total: Number(existing.total) };
      continue;
    }

    const duplicates = await findPossibleDuplicates({
      providerId: seed.providerId,
      invoiceNumber: seed.invoiceNumber,
      total: seed.total,
      invoiceDate: seed.invoiceDate,
    });

    const status = seed.dueDate < daysAgo(0) ? "OVERDUE" : "PENDING";

    const invoice = await prisma.invoice.create({
      data: {
        providerId: seed.providerId,
        invoiceNumber: seed.invoiceNumber,
        invoiceDate: seed.invoiceDate,
        dueDate: seed.dueDate,
        subtotal: seed.subtotal,
        tax: seed.tax,
        total: seed.total,
        categoryId: seed.categoryId,
        notes: seed.notes,
        status,
        isDuplicateFlag: duplicates.length > 0,
        createdById: owner.id,
      },
    });

    if (duplicates.length > 0) {
      await prisma.alert.create({
        data: {
          type: "INVOICE_DUPLICATE",
          severity: "WARNING",
          message: `Posible factura duplicada: ${seed.invoiceNumber} tiene el mismo monto y proveedor que otra factura reciente.`,
          entityType: "invoice",
          invoiceId: invoice.id,
        },
      });
    }

    invoicesByNumber[seed.invoiceNumber] = { id: invoice.id, total: seed.total };
  }

  // Alerta de "vence mañana" para INV-778, igual que generaría el motor de alertas real.
  const invoiceDueTomorrow = invoicesByNumber["INV-778"];
  if (invoiceDueTomorrow) {
    const alreadyAlerted = await prisma.alert.findFirst({
      where: { type: "INVOICE_DUE_TOMORROW", invoiceId: invoiceDueTomorrow.id },
    });
    if (!alreadyAlerted) {
      await prisma.alert.create({
        data: {
          type: "INVOICE_DUE_TOMORROW",
          severity: "WARNING",
          message: "Esta factura vence mañana.",
          entityType: "invoice",
          invoiceId: invoiceDueTomorrow.id,
        },
      });
    }
  }

  type CheckSeed = {
    checkNumber: string;
    payee: string;
    amount: number;
    issueDate: Date;
    status: "PENDING" | "ISSUED" | "CLEARED" | "CANCELLED";
    clearedAt?: Date;
    invoiceNumber?: string;
    appliedPayment?: boolean;
  };

  const checkSeeds: CheckSeed[] = [
    {
      checkNumber: "1001",
      payee: "Panadería El Trigal",
      amount: 800,
      issueDate: daysAgo(8),
      status: "CLEARED",
      clearedAt: daysAgo(5),
      invoiceNumber: "INV-222",
      appliedPayment: true,
    },
    {
      checkNumber: "1002",
      payee: "Panadería El Trigal",
      amount: 600,
      issueDate: daysAgo(3),
      status: "ISSUED",
      invoiceNumber: "INV-221",
      appliedPayment: true,
    },
    {
      checkNumber: "1003",
      payee: "Carnes Selectas del Valle",
      amount: 4200,
      issueDate: daysAgo(1),
      status: "PENDING",
      invoiceNumber: "INV-3341",
    },
    {
      checkNumber: "1004",
      payee: "Distribuidora La Central",
      amount: 2875,
      issueDate: daysAgo(0),
      status: "ISSUED",
      invoiceNumber: "INV-1001",
    },
    {
      checkNumber: "1005",
      payee: "ProClean Suministros",
      amount: 630,
      issueDate: daysFromNow(2),
      status: "PENDING",
      invoiceNumber: "INV-55",
    },
  ];

  for (const seed of checkSeeds) {
    const existing = await prisma.check.findFirst({ where: { checkNumber: seed.checkNumber, bankName: "TD Bank" } });
    const invoiceId = seed.invoiceNumber ? invoicesByNumber[seed.invoiceNumber]?.id : undefined;

    const check =
      existing ??
      (await prisma.check.create({
        data: {
          checkNumber: seed.checkNumber,
          payee: seed.payee,
          bankName: "TD Bank",
          amount: seed.amount,
          issueDate: seed.issueDate,
          status: seed.status,
          clearedAt: seed.clearedAt,
          invoiceId,
          reconciled: seed.status === "CLEARED",
          createdById: owner.id,
        },
      }));

    if (!existing && seed.appliedPayment && invoiceId) {
      await prisma.payment.create({
        data: {
          invoiceId,
          checkId: check.id,
          amount: seed.amount,
          paidAt: seed.clearedAt ?? seed.issueDate,
          method: "CHECK",
          createdById: owner.id,
        },
      });

      const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      const paid = await prisma.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } });
      const totalPaid = Number(paid._sum.amount ?? 0);
      const newStatus = totalPaid >= Number(invoice.total) ? "PAID" : "PARTIAL";
      await prisma.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });
    }
  }

  console.log("Datos de prueba creados: 6 proveedores, 9 facturas, 5 cheques.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
