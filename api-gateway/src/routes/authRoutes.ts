import { Router, Request, Response } from 'express';
import { authServiceClient } from '../grpc/clients/AuthServiceClient';

const router = Router();

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    console.log(`📝 Registro de usuario: ${email} - Rol: ${role}`);

    const response = await authServiceClient.register({
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      role
    });

    res.json({
      success: response.success,
      message: response.message,
      user: response.user ? {
        id: response.user.id,
        email: response.user.email,
        firstName: response.user.first_name,
        lastName: response.user.last_name,
        role: response.user.role
      } : null
    });
  } catch (error: any) {
    console.error('Error en /auth/register:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al registrar usuario'
    });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    console.log(`🔐 Login: ${email}`);

    const response = await authServiceClient.login({ email, password });

    if (response.success) {
      res.json({
        success: true,
        token: response.token,
        user: response.user ? {
          id: response.user.id,
          email: response.user.email,
          firstName: response.user.first_name,
          lastName: response.user.last_name,
          role: response.user.role
        } : null
      });
    } else {
      res.status(401).json({
        success: false,
        message: response.message || 'Credenciales inválidas'
      });
    }
  } catch (error: any) {
    console.error('Error en /auth/login:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al iniciar sesión'
    });
  }
});

// POST /auth/validate
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    const response = await authServiceClient.validateToken(token);

    res.json({
      valid: response.valid,
      userId: response.user_id,
      email: response.email,
      role: response.role
    });
  } catch (error: any) {
    console.error('Error en /auth/validate:', error);
    res.status(500).json({
      valid: false,
      message: error.message || 'Error al validar token'
    });
  }
});

export default router;
