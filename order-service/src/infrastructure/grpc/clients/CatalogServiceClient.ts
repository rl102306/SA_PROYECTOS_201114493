import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/catalog.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const catalogProto = grpc.loadPackageDefinition(packageDefinition).catalog as any;

export interface ValidationRequest {
  restaurantId: string;
  items: Array<{
    productId: string;
    quantity: number;
    expectedPrice: number;
  }>;
}

export interface ValidationError {
  productId: string;
  errorType: string;
  message: string;
}

export interface ValidationResponse {
  isValid: boolean;
  message: string;
  errors: ValidationError[];
}

export class CatalogServiceClient {
  private client: any;

  constructor() {
    const catalogServiceUrl = process.env.CATALOG_SERVICE_URL || 'localhost:50051';
    
    console.log(`🔗 Conectando a Catalog Service en: ${catalogServiceUrl}`);
    
    this.client = new catalogProto.CatalogService(
      catalogServiceUrl,
      grpc.credentials.createInsecure()
    );
  }

  async validateOrder(request: ValidationRequest): Promise<ValidationResponse> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        restaurant_id: request.restaurantId,
        items: request.items.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          expected_price: item.expectedPrice
        }))
      };

      console.log(`📡 Enviando validación gRPC para ${request.items.length} productos...`);

      this.client.ValidateOrder(grpcRequest, (error: any, response: any) => {
        if (error) {
          console.error('❌ Error en validación gRPC:', error.message);
          reject(new Error(`Error de comunicación con Catalog Service: ${error.message}`));
          return;
        }

        const result: ValidationResponse = {
          isValid: response.is_valid,
          message: response.message,
          errors: (response.errors || []).map((err: any) => ({
            productId: err.product_id,
            errorType: err.error_type,
            message: err.message
          }))
        };

        if (result.isValid) {
          console.log('✅ Validación gRPC exitosa');
        } else {
          console.log(`⚠️ Validación gRPC fallida: ${result.errors.length} errores`);
        }

        resolve(result);
      });
    });
  }

  async getProduct(productId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetProduct({ product_id: productId }, (error: any, response: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }
}
