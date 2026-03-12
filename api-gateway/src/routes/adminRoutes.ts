import { Router, Request, Response } from 'express';
import { orderServiceClient } from '../grpc/clients/OrderServiceClient';
import { notificationServiceClient } from '../grpc/clients/NotificationServiceClient';
import { authServiceClient } from '../grpc/clients/AuthServiceClient';
import { deliveryServiceClient } from '../grpc/clients/DeliveryServiceClient';
import { catalogServiceClient } from '../grpc/clients/CatalogServiceClient';
import { paymentServiceClient } from '../grpc/clients/PaymentServiceClient';
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

    const orders = response.orders || [];

    // Enriquecer cada orden con datos del delivery service (foto, quién canceló, motivo)
    const enriched = await Promise.all(orders.map(async (order: any) => {
      try {
        const deliveryResp = await deliveryServiceClient.getDeliveryByOrder(order.id);
        if (deliveryResp.success && deliveryResp.delivery) {
          const delivery = deliveryResp.delivery;
          const extra: any = {};

          if (delivery.delivery_photo) {
            extra.delivery_photo = delivery.delivery_photo;
          }

          // Si la orden está CANCELLED y el delivery también está CANCELLED → canceló el repartidor
          if (order.status === 'CANCELLED' && delivery.status === 'CANCELLED') {
            extra.cancelled_by = 'REPARTIDOR';
            extra.cancellation_reason = delivery.cancellation_reason || '';
          } else if (order.status === 'CANCELLED') {
            // Hay delivery pero no está cancelado (ej: ASSIGNED) → canceló el restaurante antes de asignar
            extra.cancelled_by = 'RESTAURANTE';
          }

          return { ...order, ...extra };
        }
      } catch (_) {}

      // Sin registro en delivery service → el restaurante canceló antes de crear la entrega
      if (order.status === 'CANCELLED') {
        return { ...order, cancelled_by: 'RESTAURANTE' };
      }
      return order;
    }));

    res.json({
      success: response.success,
      message: response.message,
      orders: enriched
    });
  } catch (error: any) {
    console.error('Error en GET /admin/orders:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al obtener pedidos' });
  }
});

// GET /admin/restaurant-orders — pedidos del restaurante autenticado (todos los estados activos)
router.get('/restaurant-orders', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.restaurantId;

    if (!restaurantId) {
      res.json({ success: true, orders: [] });
      return;
    }

    const response = await orderServiceClient.getAllOrders({
      statuses: ['PAID', 'CONFIRMED', 'PREPARING', 'IN_DELIVERY'],
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

    // Cuando la orden pasa a IN_DELIVERY (lista para recoger), crear registro en Delivery Service
    if (statusUp === 'IN_DELIVERY') {
      const deliveryAddress = order.delivery_address || 'Dirección del cliente';

      // Obtener dirección del restaurante desde Catalog Service
      let pickupAddress = `Restaurante (ID: ${order.restaurant_id})`;
      try {
        const catalogResp = await catalogServiceClient.listRestaurants(false);
        const restaurant = (catalogResp.restaurants || []).find(
          (r: any) => r.id === order.restaurant_id
        );
        if (restaurant?.address) {
          pickupAddress = `${restaurant.name} — ${restaurant.address}`;
        } else if (restaurant?.name) {
          pickupAddress = restaurant.name;
        }
      } catch (err) {
        console.error('⚠️ No se pudo obtener dirección del restaurante:', err);
      }

      deliveryServiceClient.createDelivery(id, pickupAddress, deliveryAddress).catch((err: any) => {
        console.error('⚠️ No se pudo crear entrega en Delivery Service:', err);
      });
    }

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

// POST /admin/orders/:orderId/refund — admin aprueba reembolso
router.post('/orders/:orderId/refund', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const refundResp = await paymentServiceClient.refundPayment(orderId);

    if (!refundResp.success) {
      res.status(400).json({ success: false, message: refundResp.message });
      return;
    }

    // Notificación de reembolso (no bloqueante)
    const orderResp = await orderServiceClient.getOrder(orderId).catch(() => ({ found: false }));
    if (orderResp.found && orderResp.order) {
      const order = orderResp.order;
      const userResp = await authServiceClient.getUserById(order.user_id || '').catch(() => ({ found: false }));
      const userEmail = userResp.found ? (userResp.user?.email || '') : '';
      const userName = userResp.found
        ? `${userResp.user?.first_name || ''} ${userResp.user?.last_name || ''}`.trim() || userEmail
        : 'Cliente';
      const payment = refundResp.payment;

      if (userEmail && payment) {
        notificationServiceClient.sendPaymentRefunded({
          user_id: order.user_id || '',
          user_email: userEmail,
          user_name: userName,
          order_id: orderId,
          order_number: orderId.substring(0, 8).toUpperCase(),
          amount: payment.amount || 0,
          currency: payment.currency || 'GTQ',
          amount_gtq: payment.amount_gtq || 0,
          amount_usd: payment.amount_usd || 0,
          exchange_rate: payment.exchange_rate || 0,
          payment_method: payment.payment_method || '',
          status: 'REEMBOLSADO'
        }).catch(() => {});
      }
    }

    res.json({ success: true, message: 'Reembolso aprobado', payment: refundResp.payment });
  } catch (error: any) {
    console.error('Error en POST /admin/orders/:orderId/refund:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al aprobar reembolso' });
  }
});

// ===== COUPON MANAGEMENT (ADMIN) =====

// GET /admin/coupons/pending — listar cupones pendientes de aprobación
router.get('/coupons/pending', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const response = await catalogServiceClient.listPendingCoupons();
    res.json({ success: true, coupons: response.coupons || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener cupones pendientes' });
  }
});

// PATCH /admin/coupons/:id/approve — aprobar cupón
router.patch('/coupons/:id/approve', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await catalogServiceClient.approveCoupon(id);
    res.status(response.success ? 200 : 400).json({
      success: response.success,
      message: response.message,
      coupon: response.coupon
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al aprobar cupón' });
  }
});

export default router;
