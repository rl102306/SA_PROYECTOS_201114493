import { Request, Response, NextFunction } from 'express';
import { authServiceClient } from '../grpc/clients/AuthServiceClient';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validar token con Auth Service
    const validation = await authServiceClient.validateToken(token);

    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Agregar información del usuario al request
    (req as any).user = {
      userId: validation.user_id,
      email: validation.email,
      role: validation.role
    };

    next();
  } catch (error) {
    console.error('Error en authMiddleware:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar token'
    });
  }
}
