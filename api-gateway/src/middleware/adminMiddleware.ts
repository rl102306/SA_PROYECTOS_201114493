import { Request, Response, NextFunction } from 'express';

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'RESTAURANT')) {
    res.status(403).json({ success: false, message: 'Acceso denegado: se requiere rol ADMIN o RESTAURANT' });
    return;
  }
  next();
}
