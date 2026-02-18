import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as dotenv from 'dotenv';
import path from 'path';
import { createDatabasePool, initializeDatabase } from './infrastructure/database/postgres/config';
import { DIContainer } from './infrastructure/di/container';
import { CreateOrderUseCase } from './application/usecases/CreateOrderUseCase';
import { CreateOrderDTO } from './application/dtos/CreateOrderDTO';

dotenv.config();

const PROTO_PATH = path.join(__dirname, './infrastructure/grpc/proto/order.proto');
const GRPC_PORT = process.env.GRPC_PORT || '50053';

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

  const orderProto = grpc.loadPackageDefinition(packageDefinition).order as any;

  // Crear servidor gRPC
  const server = new grpc.Server();

  const createOrderUseCase = container.resolve<CreateOrderUseCase>('CreateOrderUseCase');

  // Implementar servicios gRPC
  server.addService(orderProto.OrderService.service, {
    CreateOrder: async (call: any, callback: any) => {
      try {
        const { user_id, restaurant_id, items, delivery_address } = call.request;

        const dto = new CreateOrderDTO({
          userId: user_id,
          restaurantId: restaurant_id,
          items: items.map((item: any) => ({
            productId: item.product_id,
            quantity: item.quantity,
            price: item.price
          })),
          deliveryAddress: delivery_address
        });

        const order = await createOrderUseCase.execute(dto);

        callback(null, {
          success: true,
          message: 'Orden creada exitosamente',
          order: {
            id: order.id,
            user_id: order.userId,
            restaurant_id: order.restaurantId,
            items: order.items.map(item => ({
              product_id: item.productId,
              quantity: item.quantity,
              price: item.price
            })),
            status: order.status,
            total_amount: order.totalAmount,
            delivery_address: order.deliveryAddress || '',
            created_at: order.createdAt.toISOString()
          }
        });
      } catch (error: any) {
        console.error('❌ Error en CreateOrder:', error);
        callback(null, {
          success: false,
          message: error.message || 'Error al crear orden',
          order: null
        });
      }
    },

    GetOrder: async (call: any, callback: any) => {
      try {
        const { order_id } = call.request;
        const orderRepository = container.resolve('OrderRepository');
        const order = await orderRepository.findById(order_id);

        if (!order) {
          callback(null, { found: false, order: null });
          return;
        }

        callback(null, {
          found: true,
          order: {
            id: order.id,
            user_id: order.userId,
            restaurant_id: order.restaurantId,
            items: order.items,
            status: order.status,
            total_amount: order.totalAmount,
            delivery_address: order.deliveryAddress || '',
            created_at: order.createdAt.toISOString()
          }
        });
      } catch (error) {
        console.error('Error en GetOrder:', error);
        callback({ code: 13, message: 'Error interno del servidor' });
      }
    },

    GetUserOrders: async (call: any, callback: any) => {
      try {
        const { user_id } = call.request;
        const orderRepository = container.resolve('OrderRepository');
        const orders = await orderRepository.findByUserId(user_id);

        callback(null, {
          orders: orders.map(order => ({
            id: order.id,
            user_id: order.userId,
            restaurant_id: order.restaurantId,
            items: order.items,
            status: order.status,
            total_amount: order.totalAmount,
            delivery_address: order.deliveryAddress || '',
            created_at: order.createdAt.toISOString()
          }))
        });
      } catch (error) {
        console.error('Error en GetUserOrders:', error);
        callback({ code: 13, message: 'Error interno del servidor' });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('❌ Error al iniciar servidor gRPC:', error);
        process.exit(1);
      }
      console.log(`🚀 Order Service (gRPC) escuchando en puerto ${port}`);
      server.start();
    }
  );
}

startServer().catch((error) => {
  console.error('❌ Error fatal al iniciar el servidor:', error);
  process.exit(1);
});
