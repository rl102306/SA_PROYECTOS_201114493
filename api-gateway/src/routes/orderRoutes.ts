import { Router, Request, Response } from 'express';
import { orderServiceClient } from '../grpc/clients/OrderServiceClient';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// POST /orders - Crear orden (requiere autenticación)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { restaurantId, items, deliveryAddress } = req.body;

    console.log(`📦 Creando orden para usuario ${userId}`);

    const response = await orderServiceClient.createOrder({
      user_id: userId,
      restaurant_id: restaurantId,
      items: items.map((item: any) => ({
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price
      })),
      delivery_address: deliveryAddress || ''
    });

    if (response.success) {
      res.json({
        success: true,
        message: response.message,
        order: response.order ? {
          id: response.order.id,
          userId: response.order.user_id,
          restaurantId: response.order.restaurant_id,
          items: response.order.items,
          status: response.order.status,
          totalAmount: response.order.total_amount,
          deliveryAddress: response.order.delivery_address,
          createdAt: response.order.created_at
        } : null
      });
    } else {
      res.status(400).json({
        success: false,
        message: response.message || 'Error al crear orden'
      });
    }
  } catch (error: any) {
    console.error('Error en POST /orders:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear orden'
    });
  }
});

// GET /orders/:id - Obtener orden por ID
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const response = await orderServiceClient.getOrder(id);

    if (response.found) {
      res.json({
        success: true,
        order: response.order
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }
  } catch (error: any) {
    console.error('Error en GET /orders/:id:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener orden'
    });
  }
});

// GET /orders - Obtener órdenes del usuario autenticado
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const response = await orderServiceClient.getUserOrders(userId);

    res.json({
      success: true,
      orders: response.orders || []
    });
  } catch (error: any) {
    console.error('Error en GET /orders:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener órdenes'
    });
  }
});

export default router;
