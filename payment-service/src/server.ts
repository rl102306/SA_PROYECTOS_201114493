import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import dotenv from 'dotenv';
import { createDatabasePool, initializeDatabase } from './infrastructure/database/postgres/config';
import { DIContainer } from './infrastructure/di/DIContainer';

dotenv.config();

const PROTO_PATH = path.join(__dirname, './infrastructure/grpc/proto/payment.proto');
const PORT = process.env.GRPC_PORT || 50057;

async function main() {
  try {
    console.log('🚀 Iniciando Payment Service...');

    const pool = createDatabasePool();
    await initializeDatabase(pool);

    DIContainer.initialize(pool);
    const container = DIContainer.getInstance();
    const handler = container.getPaymentServiceHandler();

    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    const paymentProto = grpc.loadPackageDefinition(packageDefinition).payment as any;
    const server = new grpc.Server();

    server.addService(paymentProto.PaymentService.service, {
      ProcessPayment: handler.ProcessPayment.bind(handler),
      GetPaymentByOrder: handler.GetPaymentByOrder.bind(handler)
    });

    server.bindAsync(
      `0.0.0.0:${PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          console.error('❌ Error al iniciar servidor:', error);
          process.exit(1);
        }
        console.log(`💳 Payment Service escuchando en puerto ${port}`);
      }
    );

    process.on('SIGINT', () => {
      console.log('\n🛑 Cerrando Payment Service...');
      server.tryShutdown(() => {
        pool.end();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Error fatal en Payment Service:', error);
    process.exit(1);
  }
}

main();
