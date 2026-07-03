// Seed inicial: roles del sistema y usuario Dueño.
// Ejecutar con: npm run prisma:seed
import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const ROLE_PERMISSIONS: Record<RoleName, Record<string, boolean>> = {
  OWNER: {
    viewBankBalance: true,
    manageBankConnection: true,
    manageInvoices: true,
    manageChecks: true,
    manageProviders: true,
    uploadAttachments: true,
    viewReconciliation: true,
    viewCashFlow: true,
    viewReports: true,
    manageUsers: true,
    viewAuditLog: true,
  },
  ADMIN: {
    viewBankBalance: false, // habilitable por el dueño via employeeCanViewBalances-equivalente
    manageBankConnection: false,
    manageInvoices: true,
    manageChecks: true,
    manageProviders: true,
    uploadAttachments: true,
    viewReconciliation: true,
    viewCashFlow: true,
    viewReports: true,
    manageUsers: false,
    viewAuditLog: false,
  },
  ACCOUNTANT: {
    viewBankBalance: true,
    manageBankConnection: false,
    manageInvoices: false,
    manageChecks: false,
    manageProviders: false,
    uploadAttachments: false,
    viewReconciliation: true,
    viewCashFlow: true,
    viewReports: true,
    manageUsers: false,
    viewAuditLog: false,
  },
  EMPLOYEE: {
    viewBankBalance: false,
    manageBankConnection: false,
    manageInvoices: false,
    manageChecks: false,
    manageProviders: false,
    uploadAttachments: true,
    viewReconciliation: false,
    viewCashFlow: false,
    viewReports: false,
    manageUsers: false,
    viewAuditLog: false,
  },
};

async function main() {
  for (const roleName of Object.values(RoleName)) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: { permissions: ROLE_PERMISSIONS[roleName] },
      create: { name: roleName, permissions: ROLE_PERMISSIONS[roleName] },
    });
  }

  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "dueno@pachossupermarket.com";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe123!";
  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.OWNER } });

  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      fullName: "Dueño Pachos Supermarket",
      email: ownerEmail,
      passwordHash: await bcrypt.hash(ownerPassword, 12),
      roleId: ownerRole.id,
    },
  });

  console.log(`Seed completo. Usuario dueño: ${ownerEmail} (cambia la contraseña en el primer login).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
