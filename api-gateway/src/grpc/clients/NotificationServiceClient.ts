import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/notification.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const notificationProto = grpc.loadPackageDefinition(packageDefinition).notification as any;

export class NotificationServiceClient {
  private client: any;

  constructor() {
    const url = process.env.NOTIFICATION_SERVICE_URL || 'localhost:50055';
    console.log(`🔗 Conectando a Notification Service en: ${url}`);
    this.client = new notificationProto.NotificationService(
      url,
      grpc.credentials.createInsecure()
    );
  }

  private call(method: string, data: any): Promise<any> {
    return new Promise((resolve) => {
      this.client[method](data, (error: any, response: any) => {
        if (error) {
          console.error(`❌ NotificationService.${method} error:`, error.message);
          resolve({ success: false, message: error.message });
          return;
        }
        resolve(response);
      });
    });
  }

  sendOrderCreated(data: {
    user_id: string; user_email: string; user_name: string;
    order_id: string; order_number: string; products: string;
    total_amount: number; status: string;
  }): Promise<any> {
    return this.call('SendOrderCreatedNotification', data);
  }

  sendOrderCancelled(data: {
    user_id: string; user_email: string; user_name: string;
    order_id: string; order_number: string; products: string;
    status: string; cancelled_by: string; cancellation_reason: string;
    restaurant_name: string; delivery_person_name: string;
  }): Promise<any> {
    return this.call('SendOrderCancelledNotification', data);
  }

  sendOrderRejected(data: {
    user_id: string; user_email: string; user_name: string;
    order_id: string; order_number: string; products: string;
    restaurant_name: string; status: string;
  }): Promise<any> {
    return this.call('SendOrderRejectedNotification', data);
  }

  sendOrderInTransit(data: {
    user_id: string; user_email: string; user_name: string;
    order_id: string; order_number: string; products: string;
    delivery_person_name: string; status: string;
  }): Promise<any> {
    return this.call('SendOrderInTransitNotification', data);
  }

  sendOrderDelivered(data: {
    user_id: string; user_email: string; user_name: string;
    order_id: string; order_number: string; products: string;
    total_amount: number; status: string;
  }): Promise<any> {
    return this.call('SendOrderDeliveredNotification', data);
  }

  sendPaymentRefunded(data: {
    user_id: string; user_email: string; user_name: string;
    order_id: string; order_number: string; amount: number;
    currency: string; amount_gtq: number; amount_usd: number;
    exchange_rate: number; payment_method: string; status: string;
  }): Promise<any> {
    return this.call('SendPaymentRefundedNotification', data);
  }

  sendPaymentConfirmed(data: {
    user_id: string; user_email: string; user_name: string;
    order_id: string; order_number: string; amount: number;
    currency: string; amount_gtq: number; amount_usd: number;
    exchange_rate: number; payment_method: string; status: string;
  }): Promise<any> {
    return this.call('SendPaymentConfirmedNotification', data);
  }
}

export const notificationServiceClient = new NotificationServiceClient();
