import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/catalog.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});

const catalogProto = grpc.loadPackageDefinition(packageDefinition).catalog as any;

export class CatalogServiceClient {
  private client: any;

  constructor() {
    const url = process.env.CATALOG_SERVICE_URL || 'localhost:50051';
    console.log(`🔗 Conectando a Catalog Service en: ${url}`);
    this.client = new catalogProto.CatalogService(url, grpc.credentials.createInsecure());
  }

  async listRestaurants(activeOnly: boolean = true): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.ListRestaurants({ active_only: activeOnly }, (error: any, response: any) => {
        if (error) { reject(error); return; }
        resolve(response);
      });
    });
  }

  async getRestaurantCatalog(restaurantId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetRestaurantCatalog({ restaurant_id: restaurantId }, (error: any, response: any) => {
        if (error) { reject(error); return; }
        resolve(response);
      });
    });
  }

  async getProduct(productId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetProduct({ product_id: productId }, (error: any, response: any) => {
        if (error) { reject(error); return; }
        resolve(response);
      });
    });
  }
}

export const catalogServiceClient = new CatalogServiceClient();
