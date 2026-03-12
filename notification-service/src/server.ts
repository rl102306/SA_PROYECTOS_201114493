import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import dotenv from 'dotenv';
import { DIContainer } from './infrastructure/di/DIContainer';

dotenv.config();

const PROTO_PATH = path.join(__dirname, './infrastructure/grpc/proto/notification.proto');
const PORT = process.env.GRPC_PORT || 50055;

async function main() {
  try {
    console.log('📧 Inicializando Notification Service...');

    // Inicializar contenedor
    DIContainer.initialize();
    const container = DIContainer.getInstance();
    const handler = container.getNotificationServiceHandler();

    // Cargar proto
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    const notificationProto = grpc.loadPackageDefinition(packageDefinition).notification as any;

    // Crear servidor
    const server = new grpc.Server();

    server.addService(notificationProto.NotificationService.service, {
      SendOrderCreatedNotification: handler.SendOrderCreatedNotification.bind(handler),
      SendOrderCancelledNotification: handler.SendOrderCancelledNotification.bind(handler),
      SendOrderInTransitNotification: handler.SendOrderInTransitNotification.bind(handler),
      SendOrderRejectedNotification: handler.SendOrderRejectedNotification.bind(handler),
      SendOrderDeliveredNotification: handler.SendOrderDeliveredNotification.bind(handler),
      SendPaymentConfirmedNotification: handler.SendPaymentConfirmedNotification.bind(handler),
      SendPaymentRefundedNotification: handler.SendPaymentRefundedNotification.bind(handler)
    });

    server.bindAsync(
      `0.0.0.0:${PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          console.error('❌ Error:', error);
          return;
        }
        console.log(`🚀 Notification Service (gRPC) en puerto ${port}`);
      }
    );

    process.on('SIGINT', () => {
      console.log('\n🛑 Cerrando...');
      server.tryShutdown(() => {
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
