import { SendNotificationUseCase } from '../../../application/usecases/SendNotificationUseCase';
import { NotificationType } from '../../../domain/entities/Notification';

export class NotificationServiceHandler {
  constructor(private readonly sendNotificationUseCase: SendNotificationUseCase) {}

  async SendOrderCreatedNotification(call: any, callback: any) {
    try {
      const request = call.request;

      await this.sendNotificationUseCase.execute({
        userId: request.user_id,
        userEmail: request.user_email,
        userName: request.user_name,
        type: NotificationType.ORDER_CREATED,
        orderId: request.order_id,
        orderNumber: request.order_number,
        products: request.products,
        totalAmount: request.total_amount,
        status: request.status
      });

      callback(null, { success: true, message: 'Notificación enviada' });
    } catch (error: any) {
      console.error('❌ Error:', error);
      callback(null, { success: false, message: error.message });
    }
  }

  async SendOrderCancelledNotification(call: any, callback: any) {
    try {
      const request = call.request;
      let type: NotificationType;

      if (request.cancelled_by === 'CLIENT') {
        type = NotificationType.ORDER_CANCELLED_BY_CLIENT;
      } else if (request.cancelled_by === 'RESTAURANT') {
        type = NotificationType.ORDER_CANCELLED_BY_RESTAURANT;
      } else {
        type = NotificationType.ORDER_CANCELLED_BY_DELIVERY;
      }

      await this.sendNotificationUseCase.execute({
        userId: request.user_id,
        userEmail: request.user_email,
        userName: request.user_name,
        type,
        orderId: request.order_id,
        orderNumber: request.order_number,
        products: request.products,
        restaurantName: request.restaurant_name,
        deliveryPersonName: request.delivery_person_name,
        cancellationReason: request.cancellation_reason,
        status: request.status
      });

      callback(null, { success: true, message: 'Notificación enviada' });
    } catch (error: any) {
      console.error('❌ Error:', error);
      callback(null, { success: false, message: error.message });
    }
  }

  async SendOrderInTransitNotification(call: any, callback: any) {
    try {
      const request = call.request;

      await this.sendNotificationUseCase.execute({
        userId: request.user_id,
        userEmail: request.user_email,
        userName: request.user_name,
        type: NotificationType.ORDER_IN_TRANSIT,
        orderId: request.order_id,
        orderNumber: request.order_number,
        products: request.products,
        deliveryPersonName: request.delivery_person_name,
        status: request.status
      });

      callback(null, { success: true, message: 'Notificación enviada' });
    } catch (error: any) {
      console.error('❌ Error:', error);
      callback(null, { success: false, message: error.message });
    }
  }

  async SendOrderRejectedNotification(call: any, callback: any) {
    try {
      const request = call.request;

      await this.sendNotificationUseCase.execute({
        userId: request.user_id,
        userEmail: request.user_email,
        userName: request.user_name,
        type: NotificationType.ORDER_REJECTED,
        orderId: request.order_id,
        orderNumber: request.order_number,
        products: request.products,
        restaurantName: request.restaurant_name,
        status: request.status
      });

      callback(null, { success: true, message: 'Notificación enviada' });
    } catch (error: any) {
      console.error('❌ Error:', error);
      callback(null, { success: false, message: error.message });
    }
  }

  async SendOrderDeliveredNotification(call: any, callback: any) {
    try {
      const request = call.request;

      await this.sendNotificationUseCase.execute({
        userId: request.user_id,
        userEmail: request.user_email,
        userName: request.user_name,
        type: NotificationType.ORDER_DELIVERED,
        orderId: request.order_id,
        orderNumber: request.order_number,
        products: request.products,
        status: request.status
      });

      callback(null, { success: true, message: 'Notificación enviada' });
    } catch (error: any) {
      console.error('❌ Error:', error);
      callback(null, { success: false, message: error.message });
    }
  }
}
