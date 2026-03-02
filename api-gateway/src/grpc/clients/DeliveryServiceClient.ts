import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/delivery.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const deliveryProto = grpc.loadPackageDefinition(packageDefinition).delivery as any;

export class DeliveryServiceClient {
  private client: any;

  constructor() {
    const url = process.env.DELIVERY_SERVICE_URL || 'localhost:50054';
    console.log(`🔗 Conectando a Delivery Service en: ${url}`);
    this.client = new deliveryProto.DeliveryService(url, grpc.credentials.createInsecure());
  }

  async getPendingDeliveries(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetPendingDeliveries({}, (error: any, response: any) => {
        if (error) { reject(error); return; }
        resolve(response);
      });
    });
  }

  async getDeliveryPersonDeliveries(deliveryPersonId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetDeliveryPersonDeliveries(
        { delivery_person_id: deliveryPersonId },
        (error: any, response: any) => {
          if (error) { reject(error); return; }
          resolve(response);
        }
      );
    });
  }

  async updateDeliveryStatus(deliveryId: string, status: string, cancellationReason?: string, deliveryPhoto?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.UpdateDeliveryStatus(
        {
          delivery_id: deliveryId,
          status,
          cancellation_reason: cancellationReason || '',
          delivery_photo: deliveryPhoto || ''
        },
        (error: any, response: any) => {
          if (error) { reject(error); return; }
          resolve(response);
        }
      );
    });
  }

  async acceptDelivery(deliveryId: string, deliveryPersonId: string, deliveryPersonName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.AcceptDelivery(
        { delivery_id: deliveryId, delivery_person_id: deliveryPersonId, delivery_person_name: deliveryPersonName },
        (error: any, response: any) => {
          if (error) { reject(error); return; }
          resolve(response);
        }
      );
    });
  }
}

export const deliveryServiceClient = new DeliveryServiceClient();
