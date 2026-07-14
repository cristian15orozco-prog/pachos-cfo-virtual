import { Router } from "express";
import { env } from "../config/env";
import { asyncHandler } from "../middleware/asyncHandler";
import { ensureWeeklyPayrollAllocation } from "../modules/cashflow/autoAllocationService";

const router = Router();

/**
 * Llamado por la tarea programada de GitHub Actions (todos los lunes) para
 * disparar el reparto automático de pago de trabajadores incluso si nadie
 * abrió la app ese día. Protegido con un secreto compartido en vez de sesión
 * de usuario, porque quien llama es un job automatizado, no una persona.
 */
router.post(
  "/weekly-payroll-check",
  asyncHandler(async (req, res) => {
    const secret = req.header("x-internal-secret");
    if (!secret || secret !== env.internalTaskSecret) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "No autorizado" } });
    }
    const result = await ensureWeeklyPayrollAllocation({});
    res.json({ data: result });
  })
);

export default router;
