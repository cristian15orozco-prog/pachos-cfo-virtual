import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import providersRoutes from "./providers.routes";
import invoicesRoutes from "./invoices.routes";
import checksRoutes from "./checks.routes";
import bankRoutes from "./bank.routes";
import reconciliationRoutes from "./reconciliation.routes";
import cashflowRoutes from "./cashflow.routes";
import alertsRoutes from "./alerts.routes";
import reportsRoutes from "./reports.routes";
import cfoRoutes from "./cfo.routes";
import auditLogsRoutes from "./auditLogs.routes";
import dashboardRoutes from "./dashboard.routes";
import categoriesRoutes from "./categories.routes";
import cashRegisterRoutes from "./cashRegister.routes";
import attachmentsRoutes from "./attachments.routes";
import businessSettingsRoutes from "./businessSettings.routes";
import internalRoutes from "./internal.routes";

const router = Router();

router.use("/auth", authRoutes);

// Llamado por la tarea programada de GitHub Actions con un secreto propio —
// no lleva sesión de usuario, por eso va antes del middleware de auth.
router.use("/internal", internalRoutes);

// Todo lo demás requiere sesión autenticada.
router.use(authenticate);
router.use("/users", usersRoutes);
router.use("/providers", providersRoutes);
router.use("/invoices", invoicesRoutes);
router.use("/checks", checksRoutes);
router.use("/bank", bankRoutes);
router.use("/reconciliation", reconciliationRoutes);
router.use("/cashflow", cashflowRoutes);
router.use("/alerts", alertsRoutes);
router.use("/reports", reportsRoutes);
router.use("/cfo", cfoRoutes);
router.use("/audit-logs", auditLogsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/categories", categoriesRoutes);
router.use("/cash-register", cashRegisterRoutes);
router.use("/attachments", attachmentsRoutes);
router.use("/business-settings", businessSettingsRoutes);

export default router;
