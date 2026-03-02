import { Router, Request, Response } from 'express';
import { orderServiceClient } from '../grpc/clients/OrderServiceClient';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminMiddleware } from '../middleware/adminMiddleware';

const router = Router();

// GET /admin/orders?status=DELIVERED,CANCELLED&from=2025-01-01&to=2025-12-31&userId=xxx
router.get('/orders', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const statusParam = req.query.status as string;
    const statuses = statusParam
      ? statusParam.split(',').map(s => s.trim().toUpperCase())
      : ['DELIVERED', 'CANCELLED'];

    const response = await orderServiceClient.getAllOrders({
      statuses,
      dateFrom: req.query.from as string,
      dateTo: req.query.to as string,
      userId: req.query.userId as string
    });

    res.json({
      success: response.success,
      message: response.message,
      orders: response.orders || []
    });
  } catch (error: any) {
    console.error('Error en GET /admin/orders:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al obtener pedidos' });
  }
});

export default router;
