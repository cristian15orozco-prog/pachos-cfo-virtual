import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { auditAction } from "../middleware/auditLogger";
import { asyncHandler } from "../middleware/asyncHandler";
import { hashPassword } from "../modules/auth/authService";

const router = Router();

router.get(
  "/",
  requireRole(),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ include: { role: true }, orderBy: { fullName: "asc" } });
    res.json({ data: users.map(({ passwordHash, ...u }) => u) });
  })
);

const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roleName: z.enum(["OWNER", "ADMIN", "ACCOUNTANT", "EMPLOYEE"]),
});

router.post(
  "/",
  requireRole(),
  auditAction("USER_CREATE", "user"),
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });

    const role = await prisma.role.findUniqueOrThrow({ where: { name: parsed.data.roleName } });
    const user = await prisma.user.create({
      data: {
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        roleId: role.id,
      },
    });
    const { passwordHash, ...safeUser } = user;
    res.status(201).json({ data: safeUser });
  })
);

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  roleName: z.enum(["OWNER", "ADMIN", "ACCOUNTANT", "EMPLOYEE"]).optional(),
  isActive: z.boolean().optional(),
  employeeCanViewBalances: z.boolean().optional(),
});

router.patch(
  "/:id",
  requireRole(),
  auditAction("USER_UPDATE", "user"),
  asyncHandler(async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });

    const { roleName, ...rest } = parsed.data;
    const roleId = roleName ? (await prisma.role.findUniqueOrThrow({ where: { name: roleName } })).id : undefined;

    const user = await prisma.user.update({ where: { id: req.params.id }, data: { ...rest, roleId } });
    const { passwordHash, ...safeUser } = user;
    res.json({ data: safeUser });
  })
);

router.delete(
  "/:id",
  requireRole(),
  auditAction("USER_DEACTIVATE", "user"),
  asyncHandler(async (req, res) => {
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).send();
  })
);

const passwordSchema = z.object({
  newPassword: z.string().min(8),
});

/**
 * Solo el Dueño puede resetear la contraseña de cualquier usuario (incluida
 * la suya propia), sin necesidad de la contraseña anterior — control total,
 * igual que el resto de la gestión de usuarios. Queda registrado en
 * auditoría quién lo hizo y cuándo.
 */
router.patch(
  "/:id/password",
  requireRole(),
  auditAction("USER_PASSWORD_RESET", "user"),
  asyncHandler(async (req, res) => {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.message } });

    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    });
    res.status(204).send();
  })
);

export default router;
