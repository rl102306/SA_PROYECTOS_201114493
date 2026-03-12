import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/fx.proto');

export interface ExchangeRateResult {
  success: boolean;
  rate: number;
  source: string;
  message: string;
}

export class FxServiceClient {
  private client: any;

  constructor() {
    const fxServiceUrl = process.env.FX_SERVICE_URL || 'localhost:50056';
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    const fxProto = grpc.loadPackageDefinition(packageDefinition).fx as any;
    this.client = new fxProto.FxService(fxServiceUrl, grpc.credentials.createInsecure());
  }

  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRateResult> {
    return new Promise((resolve, reject) => {
      this.client.GetExchangeRate(
        { from_currency: fromCurrency, to_currency: toCurrency },
        (error: any, response: any) => {
          if (error) return reject(error);
          resolve(response);
        }
      );
    });
  }
}
