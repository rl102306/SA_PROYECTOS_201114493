import { Request, Response, NextFunction } from 'express';

export function restaurantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== 'RESTAURANT') {
    res.status(403).json({ success: false, message: 'Acceso denegado: se requiere rol RESTAURANT' });
    return;
  }
  next();
}
