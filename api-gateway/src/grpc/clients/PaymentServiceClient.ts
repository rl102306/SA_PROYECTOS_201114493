import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/payment.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const paymentProto = grpc.loadPackageDefinition(packageDefinition).payment as any;

export class PaymentServiceClient {
  private client: any;

  constructor() {
    const url = process.env.PAYMENT_SERVICE_URL || 'localhost:50057';
    console.log(`🔗 Conectando a Payment Service en: ${url}`);
    this.client = new paymentProto.PaymentService(url, grpc.credentials.createInsecure());
  }

  async processPayment(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.ProcessPayment(data, (error: any, response: any) => {
        if (error) { reject(error); return; }
        resolve(response);
      });
    });
  }

  async getPaymentByOrder(orderId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetPaymentByOrder({ order_id: orderId }, (error: any, response: any) => {
        if (error) { reject(error); return; }
        resolve(response);
      });
    });
  }

  async refundPayment(orderId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.RefundPayment({ order_id: orderId }, (error: any, response: any) => {
        if (error) { reject(error); return; }
        resolve(response);
      });
    });
  }
}

export const paymentServiceClient = new PaymentServiceClient();
