import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../modules/auth/authService";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: string };
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Missing bearer token" } });
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Invalid or expired token" } });
  }
}
