import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/notification.proto');

export interface PaymentNotificationData {
  userId: string;
  userEmail: string;
  userName: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  amountGtq: number;
  amountUsd: number;
  exchangeRate: number;
  paymentMethod: string;
  status: string;
}

export class NotificationServiceClient {
  private client: any;

  constructor() {
    const url = process.env.NOTIFICATION_SERVICE_URL || 'localhost:50055';
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const notificationProto = grpc.loadPackageDefinition(packageDefinition).notification as any;
    this.client = new notificationProto.NotificationService(url, grpc.credentials.createInsecure());
  }

  async sendPaymentConfirmed(data: PaymentNotificationData): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.SendPaymentConfirmedNotification(
        {
          user_id: data.userId,
          user_email: data.userEmail,
          user_name: data.userName,
          order_id: data.orderId,
          order_number: data.orderNumber,
          amount: data.amount,
          currency: data.currency,
          amount_gtq: data.amountGtq,
          amount_usd: data.amountUsd,
          exchange_rate: data.exchangeRate,
          payment_method: data.paymentMethod,
          status: data.status
        },
        (error: any, response: any) => {
          if (error) {
            console.error('⚠️ Error al enviar notificación de pago confirmado:', error.message);
            resolve(); // No fallar el pago por error en notificación
            return;
          }
          if (response?.success) {
            console.log('📧 Notificación de pago confirmado enviada a:', data.userEmail);
          }
          resolve();
        }
      );
    });
  }

  async sendPaymentRefunded(data: PaymentNotificationData): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.SendPaymentRefundedNotification(
        {
          user_id: data.userId,
          user_email: data.userEmail,
          user_name: data.userName,
          order_id: data.orderId,
          order_number: data.orderNumber,
          amount: data.amount,
          currency: data.currency,
          amount_gtq: data.amountGtq,
          amount_usd: data.amountUsd,
          exchange_rate: data.exchangeRate,
          payment_method: data.paymentMethod,
          status: data.status
        },
        (error: any, response: any) => {
          if (error) {
            console.error('⚠️ Error al enviar notificación de reembolso:', error.message);
            resolve(); // No fallar la operación por error en notificación
            return;
          }
          if (response?.success) {
            console.log('📧 Notificación de reembolso enviada a:', data.userEmail);
          }
          resolve();
        }
      );
    });
  }
}
