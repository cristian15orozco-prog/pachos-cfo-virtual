import { NextFunction, Request, Response } from "express";

/**
 * Express 4 no reenvía automáticamente los rechazos de promesas lanzados
 * dentro de handlers async al middleware de errores — un error sin capturar
 * ahí se convierte en un "unhandled rejection" que tumba todo el proceso.
 * Este wrapper captura cualquier rechazo y lo pasa a next(), para que el
 * error handler de app.ts responda con un JSON limpio en vez de caerse.
 */
export function asyncHandler<T = void>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
