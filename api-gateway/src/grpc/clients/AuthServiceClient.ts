import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/auth.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const authProto = grpc.loadPackageDefinition(packageDefinition).auth as any;

export class AuthServiceClient {
  private client: any;

  constructor() {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'localhost:50052';
    console.log(`🔗 Conectando a Auth Service en: ${authServiceUrl}`);
    
    this.client = new authProto.AuthService(
      authServiceUrl,
      grpc.credentials.createInsecure()
    );
  }

  async register(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.Register(data, (error: any, response: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }

  async login(credentials: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.Login(credentials, (error: any, response: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }

  async validateToken(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.ValidateToken({ token }, (error: any, response: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }
}

export const authServiceClient = new AuthServiceClient();
