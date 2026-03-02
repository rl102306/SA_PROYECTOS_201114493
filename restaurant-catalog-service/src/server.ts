import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as dotenv from 'dotenv';
import path from 'path';
import { createDatabasePool, initializeDatabase } from './infrastructure/database/postgres/config';
import { DIContainer } from './infrastructure/di/container';
import { CatalogServiceHandler } from './infrastructure/grpc/handlers/CatalogServiceHandler';

dotenv.config();

const PROTO_PATH = path.join(__dirname, './infrastructure/grpc/proto/catalog.proto');
const GRPC_PORT = process.env.GRPC_PORT || '50051';

async function startServer() {
  // Crear pool de base de datos
  const pool = createDatabasePool();

  // Inicializar base de datos
  await initializeDatabase(pool);

  // Configurar DI Container
  const container = DIContainer.getInstance();
  container.register(pool);

  // Cargar proto
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const catalogProto = grpc.loadPackageDefinition(packageDefinition).catalog as any;

  // Crear servidor gRPC
  const server = new grpc.Server();

  const handler = container.resolve<CatalogServiceHandler>('CatalogServiceHandler');

  server.addService(catalogProto.CatalogService.service, {
    ValidateOrder: handler.ValidateOrder.bind(handler),
    GetProduct: handler.GetProduct.bind(handler),
    GetRestaurantCatalog: handler.GetRestaurantCatalog.bind(handler),
    ListRestaurants: handler.ListRestaurants.bind(handler)
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
