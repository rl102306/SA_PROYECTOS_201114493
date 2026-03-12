import { Router, Request, Response } from 'express';
import { orderServiceClient } from '../grpc/clients/OrderServiceClient';
import { notificationServiceClient } from '../grpc/clients/NotificationServiceClient';
import { authServiceClient } from '../grpc/clients/AuthServiceClient';
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

      // Enviar notificación de orden creada (no bloqueante)
      if (response.order) {
        const order = response.order;
        const orderNumber = order.id.substring(0, 8).toUpperCase();
        const products = (order.items || [])
          .map((i: any) => `${i.quantity}x (Q${i.price})`)
          .join(', ');
        const userEmailFromToken = (req as any).user?.email || '';

        authServiceClient.getUserById(userId).then((userResp: any) => {
          const userEmail = userResp.found ? (userResp.user?.email || userEmailFromToken) : userEmailFromToken;
          const userName = userResp.found
            ? `${userResp.user?.first_name || ''} ${userResp.user?.last_name || ''}`.trim() || userEmail
            : 'Cliente';

          notificationServiceClient.sendOrderCreated({
            user_id: userId,
            user_email: userEmail,
            user_name: userName,
            order_id: order.id,
            order_number: orderNumber,
            products,
            total_amount: order.total_amount || 0,
            status: 'CREADA'
          }).catch(() => {});
        }).catch(() => {});
      }
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

// PATCH /orders/:id/cancel — el cliente cancela su pedido
router.patch('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Verificar que la orden existe y pertenece al usuario
    const orderResp = await orderServiceClient.getOrder(id);
    if (!orderResp.found) {
      res.status(404).json({ success: false, message: 'Orden no encontrada' });
      return;
    }

    const order = orderResp.order;
    if (order.user_id !== userId) {
      res.status(403).json({ success: false, message: 'No tienes permiso para cancelar esta orden' });
      return;
    }

    // Solo se puede cancelar si está en PENDING o CONFIRMED
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      res.status(400).json({ success: false, message: `No se puede cancelar una orden en estado ${order.status}` });
      return;
    }

    const updateResp = await orderServiceClient.updateOrderStatus(id, 'CANCELLED');

    if (!updateResp.success) {
      res.status(400).json({ success: false, message: updateResp.message });
      return;
    }

    // Notificación (no bloqueante)
    const orderNumber = id.substring(0, 8).toUpperCase();
    const products = (order.items || [])
      .map((i: any) => `${i.quantity}x (Q${i.price})`)
      .join(', ');
    const userResp = await authServiceClient.getUserById(userId).catch(() => ({ found: false }));
    const userEmail = userResp.found ? (userResp.user?.email || '') : ((req as any).user?.email || '');
    const userName = userResp.found
      ? `${userResp.user?.first_name || ''} ${userResp.user?.last_name || ''}`.trim() || userEmail
      : 'Cliente';

    notificationServiceClient.sendOrderCancelled({
      user_id: userId,
      user_email: userEmail,
      user_name: userName,
      order_id: id, order_number: orderNumber, products,
      status: 'CANCELLED',
      cancelled_by: 'CLIENT',
      cancellation_reason: 'Cancelado por el cliente',
      restaurant_name: '', delivery_person_name: ''
    }).catch(() => {});

    res.json({ success: true, message: 'Pedido cancelado' });
  } catch (error: any) {
    console.error('Error en PATCH /orders/:id/cancel:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al cancelar pedido' });
  }
});

export default router;
