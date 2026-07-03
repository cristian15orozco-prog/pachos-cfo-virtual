import { NextFunction, Request, Response } from "express";

/**
 * RBAC — el dueño (OWNER) siempre pasa. El resto de roles debe estar
 * explícitamente en la lista permitida para la ruta.
 * Esta es la aplicación real del control de acceso; el frontend solo
 * oculta UI, nunca es la fuente de verdad de permisos.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.auth?.role;
    if (!role) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "No autenticado" } });
    }
    if (role === "OWNER" || allowedRoles.includes(role)) {
      return next();
    }
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "No tienes permiso para esta acción" } });
  };
}
