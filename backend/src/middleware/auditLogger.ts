import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

/**
 * Registra un evento de auditoría append-only. Usar en cada endpoint que
 * toque datos financieros o bancarios (ver docs/SECURITY.md, sección 6).
 */
export async function recordAudit(params: {
  req: Request;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { req, action, entityType, entityId, metadata } = params;
  await prisma.auditLog.create({
    data: {
      userId: req.auth?.userId,
      roleAtTime: req.auth?.role,
      action,
      entityType,
      entityId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: metadata as any,
    },
  });
}

/** Middleware genérico: audita automáticamente con la acción dada tras responder. */
export function auditAction(action: string, entityType?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      if (res.statusCode < 400) {
        void recordAudit({
          req,
          action,
          entityType,
          entityId: req.params.id,
          metadata: { method: req.method, path: req.originalUrl, status: res.statusCode },
        });
      }
    });
    next();
  };
}
