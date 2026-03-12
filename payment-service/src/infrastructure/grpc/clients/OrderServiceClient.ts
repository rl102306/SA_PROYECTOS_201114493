import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/order.proto');

export class OrderServiceClient {
  private client: any;

  constructor() {
    const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'localhost:50053';
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const orderProto = grpc.loadPackageDefinition(packageDefinition).order as any;
    this.client = new orderProto.OrderService(orderServiceUrl, grpc.credentials.createInsecure());
  }

  async updateOrderStatus(orderId: string, status: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      this.client.UpdateOrderStatus(
        { order_id: orderId, status },
        (error: any, response: any) => {
          if (error) return reject(error);
          resolve(response);
        }
      );
    });
  }
}
