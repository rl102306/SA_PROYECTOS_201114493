import { Router, Request, Response } from 'express';
import { deliveryServiceClient } from '../grpc/clients/DeliveryServiceClient';
import { orderServiceClient } from '../grpc/clients/OrderServiceClient';
import { authServiceClient } from '../grpc/clients/AuthServiceClient';
import { notificationServiceClient } from '../grpc/clients/NotificationServiceClient';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// GET /deliveries/pending — entregas pendientes (para repartidores que buscan trabajo)
router.get('/pending', authMiddleware, async (req: Request, res: Response) => {
  try {
    const response = await deliveryServiceClient.getPendingDeliveries();
    res.json({ success: response.success, deliveries: response.deliveries || [] });
  } catch (error: any) {
    console.error('Error en GET /deliveries/pending:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /deliveries/my — entregas asignadas al repartidor actual
router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const response = await deliveryServiceClient.getDeliveryPersonDeliveries(userId);
    res.json({ success: response.success, deliveries: response.deliveries || [] });
  } catch (error: any) {
    console.error('Error en GET /deliveries/my:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /deliveries/:id/accept — aceptar una entrega
router.post('/:id/accept', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const deliveryPersonName = user.email;

    const response = await deliveryServiceClient.acceptDelivery(
      req.params.id,
      user.userId,
      deliveryPersonName
    );
    if (response.success) {
      res.json({ success: true, message: response.message, delivery: response.delivery });

      // Enviar notificación ORDER_IN_TRANSIT (no bloqueante)
      const orderId = response.delivery?.order_id;
      if (orderId) {
        orderServiceClient.getOrder(orderId).then(async (orderResp: any) => {
          if (!orderResp.found) return;
          const order = orderResp.order;
          const orderNumber = orderId.substring(0, 8).toUpperCase();
          const products = (order.items || [])
            .map((i: any) => `${i.quantity}x (Q${i.price})`)
            .join(', ');

          const userResp = await authServiceClient.getUserById(order.user_id || '').catch(() => ({ found: false }));
          const userEmail = userResp.found ? (userResp.user?.email || '') : '';
          const userName = userResp.found
            ? `${userResp.user?.first_name || ''} ${userResp.user?.last_name || ''}`.trim() || userEmail
            : 'Cliente';

          if (userEmail) {
            notificationServiceClient.sendOrderInTransit({
              user_id: order.user_id || '',
              user_email: userEmail,
              user_name: userName,
              order_id: orderId,
              order_number: orderNumber,
              products,
              delivery_person_name: deliveryPersonName,
              status: 'EN CAMINO'
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    } else {
      res.status(400).json({ success: false, message: response.message });
    }
  } catch (error: any) {
    console.error('Error en POST /deliveries/:id/accept:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /deliveries/:id/status — actualizar estado (con foto si DELIVERED, con motivo si CANCELLED)
router.put('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, cancellationReason, deliveryPhoto } = req.body;
    const user = (req as any).user;

    const response = await deliveryServiceClient.updateDeliveryStatus(
      req.params.id,
      status,
      cancellationReason,
      deliveryPhoto
    );

    if (response.success) {
      res.json({ success: true, message: response.message, delivery: response.delivery });

      const orderId = response.delivery?.order_id;

      // Si la entrega fue ENTREGADA: actualizar orden a DELIVERED y notificar
      if (status === 'DELIVERED' && orderId) {
        orderServiceClient.updateOrderStatus(orderId, 'DELIVERED').catch(() => {});

        orderServiceClient.getOrder(orderId).then(async (orderResp: any) => {
          if (!orderResp.found) return;
          const order = orderResp.order;
          const orderNumber = orderId.substring(0, 8).toUpperCase();
          const products = (order.items || [])
            .map((i: any) => `${i.quantity}x (Q${i.price})`)
            .join(', ');

          const userResp = await authServiceClient.getUserById(order.user_id || '').catch(() => ({ found: false }));
          const userEmail = userResp.found ? (userResp.user?.email || '') : '';
          const userName = userResp.found
            ? `${userResp.user?.first_name || ''} ${userResp.user?.last_name || ''}`.trim() || userEmail
            : 'Cliente';

          if (userEmail) {
            notificationServiceClient.sendOrderDelivered({
              user_id: order.user_id || '',
              user_email: userEmail,
              user_name: userName,
              order_id: orderId,
              order_number: orderNumber,
              products,
              total_amount: order.total_amount || 0,
              status: 'ENTREGADA'
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      // Si la entrega fue CANCELADA: actualizar orden y notificar al cliente
      if (status === 'CANCELLED' && orderId) {
        {
          // Marcar orden como CANCELLED
          orderServiceClient.updateOrderStatus(orderId, 'CANCELLED').catch(() => {});

          // Enviar notificación ORDER_CANCELLED_BY_DELIVERY (no bloqueante)
          orderServiceClient.getOrder(orderId).then(async (orderResp: any) => {
            if (!orderResp.found) return;
            const order = orderResp.order;
            const orderNumber = orderId.substring(0, 8).toUpperCase();
            const products = (order.items || [])
              .map((i: any) => `${i.quantity}x (Q${i.price})`)
              .join(', ');

            const userResp = await authServiceClient.getUserById(order.user_id || '').catch(() => ({ found: false }));
            const userEmail = userResp.found ? (userResp.user?.email || '') : '';
            const userName = userResp.found
              ? `${userResp.user?.first_name || ''} ${userResp.user?.last_name || ''}`.trim() || userEmail
              : 'Cliente';

            if (userEmail) {
              notificationServiceClient.sendOrderCancelled({
                user_id: order.user_id || '',
                user_email: userEmail,
                user_name: userName,
                order_id: orderId,
                order_number: orderNumber,
                products,
                status: 'CANCELADA',
                cancelled_by: 'DELIVERY',
                cancellation_reason: cancellationReason || 'El repartidor canceló la entrega',
                restaurant_name: '',
                delivery_person_name: user.email
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      }
    } else {
      res.status(400).json({ success: false, message: response.message });
    }
  } catch (error: any) {
    console.error('Error en PUT /deliveries/:id/status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
