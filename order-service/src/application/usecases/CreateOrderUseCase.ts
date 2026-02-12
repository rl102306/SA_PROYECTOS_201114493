import { Order, OrderStatus } from '../../domain/entities/Order';
import { IOrderRepository } from '../../domain/interfaces/IOrderRepository';
import { CatalogServiceClient } from '../../infrastructure/grpc/clients/CatalogServiceClient';
import { CreateOrderDTO } from '../dtos/CreateOrderDTO';

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly catalogClient: CatalogServiceClient
  ) {}

  async execute(dto: CreateOrderDTO): Promise<Order> {
    // 1. Validar DTO
    const errors = dto.validate();
    if (errors.length > 0) {
      throw new Error(`Errores de validación: ${errors.join(', ')}`);
    }

    console.log(`📦 Creando orden para usuario ${dto.userId} en restaurante ${dto.restaurantId}`);
    console.log(`📦 Productos: ${dto.items.length}`);

    // 2. Validar orden con el servicio de catálogo vía gRPC
    console.log('🔍 Validando orden con Catalog Service vía gRPC...');
    
    const validationResult = await this.catalogClient.validateOrder({
      restaurantId: dto.restaurantId,
      items: dto.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        expectedPrice: item.price
      }))
    });

    // 3. Si la validación falla, lanzar error con detalles
    if (!validationResult.isValid) {
      const errorMessages = validationResult.errors
        .map(err => `${err.productId}: ${err.message}`)
        .join(', ');
      
      console.log(`❌ Validación fallida: ${errorMessages}`);
      throw new Error(`Validación de orden fallida: ${errorMessages}`);
    }

    console.log('✅ Validación exitosa - procediendo a crear orden');

    // 4. Calcular total
    const totalAmount = dto.items.reduce(
      (sum, item) => sum + (item.price * item.quantity), 
      0
    );

    // 5. Crear la orden
    const order = new Order({
      userId: dto.userId,
      restaurantId: dto.restaurantId,
      items: dto.items,
      status: OrderStatus.PENDING,
      totalAmount: totalAmount,
      deliveryAddress: dto.deliveryAddress
    });

    // 6. Guardar orden
    const savedOrder = await this.orderRepository.save(order);

    console.log(`✅ Orden ${savedOrder.id} creada exitosamente - Total: $${totalAmount.toFixed(2)}`);

    return savedOrder;
  }
}
