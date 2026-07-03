import { Router } from "express";
import { z } from "zod";
import { login, verifyRefreshToken, issueTokens } from "../modules/auth/authService";
import { prisma } from "../lib/prisma";
import { recordAudit } from "../middleware/auditLogger";
import { authenticate } from "../middleware/authenticate";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "Email o contraseña inválidos" } });
  }

  try {
    const tokens = await login(parsed.data.email, parsed.data.password);
    await recordAudit({ req, action: "LOGIN", entityType: "user" });
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.json({ accessToken: tokens.accessToken });
  } catch {
    await recordAudit({ req, action: "LOGIN_FAILED", entityType: "user" });
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Credenciales inválidas" } });
  }
});

router.post("/refresh", (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sin refresh token" } });

  try {
    const { sub } = verifyRefreshToken(token);
    prisma.user.findUniqueOrThrow({ where: { id: sub }, include: { role: true } }).then((user) => {
      const tokens = issueTokens(user.id, user.role.name);
      res.json({ accessToken: tokens.accessToken });
    });
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Refresh token inválido" } });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("refreshToken");
  res.status(204).send();
});

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.userId },
    include: { role: true },
  });
  res.json({
    data: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role.name,
    },
  });
});

export default router;
