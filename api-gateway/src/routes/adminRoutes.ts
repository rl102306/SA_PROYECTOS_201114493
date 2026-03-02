import { Router, Request, Response } from 'express';
import { orderServiceClient } from '../grpc/clients/OrderServiceClient';
import { notificationServiceClient } from '../grpc/clients/NotificationServiceClient';
import { authServiceClient } from '../grpc/clients/AuthServiceClient';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminMiddleware } from '../middleware/adminMiddleware';
import { restaurantMiddleware } from '../middleware/restaurantMiddleware';

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

// GET /admin/restaurant-orders — pedidos del restaurante autenticado (todos los estados activos)
router.get('/restaurant-orders', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.userId; // userId = restaurantId (1:1)

    const response = await orderServiceClient.getAllOrders({
      statuses: ['PENDING', 'CONFIRMED', 'PREPARING', 'IN_DELIVERY'],
      restaurantId
    });

    res.json({
      success: true,
      orders: response.orders || []
    });
  } catch (error: any) {
    console.error('Error en GET /admin/restaurant-orders:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al obtener pedidos' });
  }
});

// PATCH /admin/orders/:id/status — restaurante actualiza el estado de un pedido
router.patch('/orders/:id/status', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['CONFIRMED', 'PREPARING', 'IN_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      res.status(400).json({ success: false, message: `Estado inválido. Use: ${validStatuses.join(', ')}` });
      return;
    }

    // Obtener la orden antes de cambiar estado (para la notificación)
    const orderResp = await orderServiceClient.getOrder(id);
    if (!orderResp.found) {
      res.status(404).json({ success: false, message: 'Orden no encontrada' });
      return;
    }
    const order = orderResp.order;

    // Actualizar estado
    const updateResp = await orderServiceClient.updateOrderStatus(id, status.toUpperCase());

    if (!updateResp.success) {
      res.status(400).json({ success: false, message: updateResp.message });
      return;
    }

    // Obtener email del usuario para la notificación
    const userResp = await authServiceClient.getUserById(order.user_id || '').catch(() => ({ found: false }));
    const userEmail = userResp.found ? (userResp.user?.email || '') : '';
    const userName = userResp.found
      ? `${userResp.user?.first_name || ''} ${userResp.user?.last_name || ''}`.trim() || userEmail
      : 'Cliente';

    // Enviar notificación según el nuevo estado (no bloqueante)
    const orderNumber = id.substring(0, 8).toUpperCase();
    const userId = order.user_id || '';
    const products = (order.items || [])
      .map((i: any) => `${i.quantity}x (Q${i.price})`)
      .join(', ');

    const statusUp = status.toUpperCase();

    if (statusUp === 'CANCELLED') {
      notificationServiceClient.sendOrderCancelled({
        user_id: userId, user_email: userEmail, user_name: userName,
        order_id: id, order_number: orderNumber, products,
        status: 'CANCELLED',
        cancelled_by: 'RESTAURANT',
        cancellation_reason: reason || 'El restaurante rechazó el pedido',
        restaurant_name: 'Restaurante', delivery_person_name: ''
      }).catch(() => {});
    } else if (statusUp === 'DELIVERED') {
      notificationServiceClient.sendOrderDelivered({
        user_id: userId, user_email: userEmail, user_name: userName,
        order_id: id, order_number: orderNumber, products,
        total_amount: order.total_amount || 0, status: 'DELIVERED'
      }).catch(() => {});
    }

    res.json({ success: true, message: 'Estado actualizado', status: statusUp });
  } catch (error: any) {
    console.error('Error en PATCH /admin/orders/:id/status:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al actualizar estado' });
  }
});

export default router;
