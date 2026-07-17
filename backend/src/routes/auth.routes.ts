import { Router } from "express";
import { z } from "zod";
import { login, verifyRefreshToken, issueTokens } from "../modules/auth/authService";
import { prisma } from "../lib/prisma";
import { recordAudit } from "../middleware/auditLogger";
import { authenticate } from "../middleware/authenticate";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "Email o contraseña inválidos" } });
    }

    try {
      const tokens = await login(parsed.data.email, parsed.data.password);
      await recordAudit({ req, action: "LOGIN", entityType: "user" });
      // sameSite "none" es obligatorio aquí: el frontend (Vercel) y el backend
      // (Render) viven en dominios distintos, así que toda petición entre
      // ellos es "cross-site" — con "strict" el navegador nunca mandaba esta
      // cookie de vuelta, /auth/refresh siempre fallaba, y la sesión se
      // cerraba sola a los 15 minutos sin importar el reintento automático.
      res.cookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return res.json({ accessToken: tokens.accessToken });
    } catch {
      await recordAudit({ req, action: "LOGIN_FAILED", entityType: "user" });
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Credenciales inválidas" } });
    }
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sin refresh token" } });

    try {
      const { sub } = verifyRefreshToken(token);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: sub }, include: { role: true } });
      const tokens = issueTokens(user.id, user.role.name);
      res.json({ accessToken: tokens.accessToken });
    } catch {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Refresh token inválido" } });
    }
  })
);

router.post("/logout", (req, res) => {
  // Debe repetir los mismos atributos que se usaron al crearla (secure,
  // sameSite) o el navegador no la reconoce como la misma cookie y no la borra.
  res.clearCookie("refreshToken", { httpOnly: true, secure: true, sameSite: "none" });
  res.status(204).send();
});

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
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
  })
);

export default router;
