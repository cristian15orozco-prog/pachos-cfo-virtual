import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";

export interface AccessTokenPayload {
  sub: string; // user id
  role: string; // role name
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!user || !user.isActive) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new Error("ACCOUNT_LOCKED");
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    const attempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null,
      },
    });
    throw new Error("INVALID_CREDENTIALS");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return issueTokens(user.id, user.role.name);
}

export function issueTokens(userId: string, roleName: string) {
  const accessToken = jwt.sign(
    { sub: userId, role: roleName } satisfies AccessTokenPayload,
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn } as jwt.SignOptions
  );
  const refreshToken = jwt.sign({ sub: userId }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwt.refreshSecret) as { sub: string };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
