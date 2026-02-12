import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/order.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const orderProto = grpc.loadPackageDefinition(packageDefinition).order as any;

export class OrderServiceClient {
  private client: any;

  constructor() {
    const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'localhost:50053';
    console.log(`🔗 Conectando a Order Service en: ${orderServiceUrl}`);
    
    this.client = new orderProto.OrderService(
      orderServiceUrl,
      grpc.credentials.createInsecure()
    );
  }

  async createOrder(orderData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.CreateOrder(orderData, (error: any, response: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }

  async getOrder(orderId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetOrder({ order_id: orderId }, (error: any, response: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }

  async getUserOrders(userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetUserOrders({ user_id: userId }, (error: any, response: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }
}

export const orderServiceClient = new OrderServiceClient();
