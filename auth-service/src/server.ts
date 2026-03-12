import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as dotenv from 'dotenv';
import path from 'path';
import { createDatabasePool, initializeDatabase } from './infrastructure/database/postgres/config';
import { DIContainer } from './infrastructure/di/container';
import { AuthServiceHandler } from './infrastructure/grpc/handlers/AuthServiceHandler';

dotenv.config();

const PROTO_PATH = path.join(__dirname, './infrastructure/grpc/proto/auth.proto');
const GRPC_PORT = process.env.GRPC_PORT || '50052';

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

  const authProto = grpc.loadPackageDefinition(packageDefinition).auth as any;

  // Crear servidor gRPC
  const server = new grpc.Server();

  const handler = container.resolve<AuthServiceHandler>('AuthServiceHandler');

  server.addService(authProto.AuthService.service, {
    Register: handler.Register.bind(handler),
    Login: handler.Login.bind(handler),
    ValidateToken: handler.ValidateToken.bind(handler),
    GetUserById: handler.GetUserById.bind(handler)
  });

  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('❌ Error al iniciar servidor gRPC:', error);
        process.exit(1);
      }
      console.log(`🚀 Auth Service (gRPC) escuchando en puerto ${port}`);
      server.start();
    }
  );
}

startServer().catch((error) => {
  console.error('❌ Error fatal al iniciar el servidor:', error);
  process.exit(1);
});
