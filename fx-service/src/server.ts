import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import dotenv from 'dotenv';
import { DIContainer } from './infrastructure/di/DIContainer';

dotenv.config();

const PROTO_PATH = path.join(__dirname, './infrastructure/grpc/proto/fx.proto');
const PORT = process.env.GRPC_PORT || 50056;

async function main() {
  try {
    console.log('🚀 Iniciando FX Service...');

    const container = DIContainer.getInstance();
    const handler = container.getFxServiceHandler();

    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    const fxProto = grpc.loadPackageDefinition(packageDefinition).fx as any;
    const server = new grpc.Server();

    server.addService(fxProto.FxService.service, {
      GetExchangeRate: handler.GetExchangeRate.bind(handler)
    });

    server.bindAsync(
      `0.0.0.0:${PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          console.error('❌ Error al iniciar servidor:', error);
          process.exit(1);
        }
        console.log(`💱 FX Service escuchando en puerto ${port}`);
      }
    );

    process.on('SIGINT', async () => {
      console.log('\n🛑 Cerrando FX Service...');
      server.tryShutdown(async () => {
        await container.getCache().quit();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Error fatal en FX Service:', error);
    process.exit(1);
  }
}

main();
