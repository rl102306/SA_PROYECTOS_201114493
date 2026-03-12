import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as dotenv from 'dotenv';
import path from 'path';
import { createDatabasePool, initializeDatabase } from './infrastructure/database/postgres/config';
import { DIContainer } from './infrastructure/di/container';
import { CatalogServiceHandler } from './infrastructure/grpc/handlers/CatalogServiceHandler';
import { startOrderConsumer } from './infrastructure/messaging/RabbitMQConsumer';
import { INotificationRepository } from './domain/interfaces/INotificationRepository';

dotenv.config();

const PROTO_PATH = path.join(__dirname, './infrastructure/grpc/proto/catalog.proto');
const GRPC_PORT = process.env.GRPC_PORT || '50051';

async function startServer() {
  const pool = createDatabasePool();
  await initializeDatabase(pool);

  const container = DIContainer.getInstance();
  container.register(pool);

  // Iniciar consumidor RabbitMQ (no bloqueante)
  const notificationRepo = container.resolve<INotificationRepository>('NotificationRepository');
  startOrderConsumer(notificationRepo).catch(() => {});

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const catalogProto = grpc.loadPackageDefinition(packageDefinition).catalog as any;
  const server = new grpc.Server();
  const handler = container.resolve<CatalogServiceHandler>('CatalogServiceHandler');

  server.addService(catalogProto.CatalogService.service, {
    ValidateOrder: handler.ValidateOrder.bind(handler),
    GetProduct: handler.GetProduct.bind(handler),
    GetRestaurantCatalog: handler.GetRestaurantCatalog.bind(handler),
    ListRestaurants: handler.ListRestaurants.bind(handler),
    CreateProduct: handler.CreateProduct.bind(handler),
    UpdateProduct: handler.UpdateProduct.bind(handler),
    DeleteProduct: handler.DeleteProduct.bind(handler),
    CreateRestaurant: handler.CreateRestaurant.bind(handler),
    // Promotions
    CreatePromotion: handler.CreatePromotion.bind(handler),
    ListPromotions: handler.ListPromotions.bind(handler),
    DeletePromotion: handler.DeletePromotion.bind(handler),
    // Coupons
    CreateCoupon: handler.CreateCoupon.bind(handler),
    ListCoupons: handler.ListCoupons.bind(handler),
    ApproveCoupon: handler.ApproveCoupon.bind(handler),
    ValidateCoupon: handler.ValidateCoupon.bind(handler),
    ListPendingCoupons: handler.ListPendingCoupons.bind(handler),
    // Ratings
    CreateRating: handler.CreateRating.bind(handler),
    GetRestaurantRating: handler.GetRestaurantRating.bind(handler),
    GetProductRating: handler.GetProductRating.bind(handler),
    // Notifications
    GetRestaurantNotifications: handler.GetRestaurantNotifications.bind(handler),
    MarkNotificationsRead: handler.MarkNotificationsRead.bind(handler)
  });

  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('❌ Error al iniciar servidor gRPC:', error);
        process.exit(1);
      }
      console.log(`🚀 Restaurant Catalog Service (gRPC) escuchando en puerto ${port}`);
      server.start();
    }
  );
}

startServer().catch((error) => {
  console.error('❌ Error fatal al iniciar el servidor:', error);
  process.exit(1);
});
