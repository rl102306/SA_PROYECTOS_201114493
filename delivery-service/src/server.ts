import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import dotenv from 'dotenv';
import { createDatabasePool, initializeDatabase } from './infrastructure/database/postgres/config';
import { DIContainer } from './infrastructure/di/DIContainer';

dotenv.config();

const PROTO_PATH = path.join(__dirname, './infrastructure/grpc/proto/delivery.proto');
const PORT = process.env.GRPC_PORT || 50054;

async function main() {
  try {
    // Inicializar base de datos
    console.log('🔌 Conectando a la base de datos...');
    const pool = createDatabasePool();
    await initializeDatabase(pool);
    console.log('✅ Base de datos inicializada');

    // Inicializar contenedor de dependencias
    DIContainer.initialize(pool);
    const container = DIContainer.getInstance();
    const handler = container.getDeliveryServiceHandler();

    // Cargar proto
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    const deliveryProto = grpc.loadPackageDefinition(packageDefinition).delivery as any;

    // Crear servidor gRPC
    const server = new grpc.Server();

    // Registrar servicios
    server.addService(deliveryProto.DeliveryService.service, {
      AcceptDelivery: handler.AcceptDelivery.bind(handler),
      UpdateDeliveryStatus: handler.UpdateDeliveryStatus.bind(handler),
      GetPendingDeliveries: handler.GetPendingDeliveries.bind(handler),
      GetDeliveryPersonDeliveries: handler.GetDeliveryPersonDeliveries.bind(handler),
      CreateDelivery: handler.CreateDelivery.bind(handler),
      GetDeliveryByOrder: handler.GetDeliveryByOrder.bind(handler)
    });

    // Iniciar servidor
    server.bindAsync(
      `0.0.0.0:${PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          console.error('❌ Error al iniciar servidor:', error);
          return;
        }
        console.log(`🚀 Delivery Service (gRPC) escuchando en puerto ${port}`);
      }
    );

    // Manejo de señales
    process.on('SIGINT', () => {
      console.log('\n🛑 Cerrando servidor...');
      server.tryShutdown(() => {
        pool.end();
        console.log('👋 Servidor cerrado');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

main();
