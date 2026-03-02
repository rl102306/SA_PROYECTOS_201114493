import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/fx.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const fxProto = grpc.loadPackageDefinition(packageDefinition).fx as any;

export class FxServiceClient {
  private client: any;

  constructor() {
    const url = process.env.FX_SERVICE_URL || 'localhost:50056';
    console.log(`🔗 Conectando a FX Service en: ${url}`);
    this.client = new fxProto.FxService(url, grpc.credentials.createInsecure());
  }

  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetExchangeRate(
        { from_currency: fromCurrency, to_currency: toCurrency },
        (error: any, response: any) => {
          if (error) { reject(error); return; }
          resolve(response);
        }
      );
    });
  }
}

export const fxServiceClient = new FxServiceClient();
