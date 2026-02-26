import { IProductRepository } from '../../domain/interfaces/IProductRepository';

export interface OrderItemDTO {
  productId: string;
  quantity: number;
  expectedPrice: number;
}

export interface ValidationErrorDTO {
  productId: string;
  errorType: 'NOT_FOUND' | 'WRONG_PRICE' | 'UNAVAILABLE' | 'WRONG_RESTAURANT';
  message: string;
}

export interface ValidationResultDTO {
  isValid: boolean;
  message: string;
  errors: ValidationErrorDTO[];
}

export class ValidateOrderUseCase {
  constructor(
    private readonly productRepository: IProductRepository
  ) {}

  async execute(
    restaurantId: string,
    items: OrderItemDTO[]
  ): Promise<ValidationResultDTO> {
    const errors: ValidationErrorDTO[] = [];

    for (const item of items) {
      // Verificar que el producto existe
      const product = await this.productRepository.findById(item.productId);
      
      if (!product) {
        errors.push({
          productId: item.productId,
          errorType: 'NOT_FOUND',
          message: `Producto ${item.productId} no encontrado`
        });
        continue;
      }

      // Verificar que pertenece al restaurante
      if (product.restaurantId !== restaurantId) {
        errors.push({
          productId: item.productId,
          errorType: 'WRONG_RESTAURANT',
          message: `Producto ${item.productId} no pertenece al restaurante ${restaurantId}`
        });
        continue;
      }

      // Verificar disponibilidad
      if (!product.isAvailable) {
        errors.push({
          productId: item.productId,
          errorType: 'UNAVAILABLE',
          message: `Producto ${item.productId} (${product.name}) no está disponible`
        });
        continue;
      }

      // Verificar precio (tolerancia de 0.01 para errores de punto flotante)
      if (Math.abs(product.price - item.expectedPrice) > 0.01) {
        errors.push({
          productId: item.productId,
          errorType: 'WRONG_PRICE',
          message: `Precio incorrecto para ${product.name}. Precio actual: $${product.price.toFixed(2)}, Precio recibido: $${item.expectedPrice.toFixed(2)}`
        });
      }
    }

    const isValid = errors.length === 0;

    if (isValid) {
      console.log(`✅ Validación exitosa para restaurante ${restaurantId}: ${items.length} productos`);
    } else {
      console.log(`❌ Validación fallida para restaurante ${restaurantId}: ${errors.length} errores`);
    }

    return {
      isValid,
      message: isValid 
        ? 'Validación exitosa - Todos los productos son válidos' 
        : `Validación fallida: ${errors.length} error(es) encontrado(s)`,
      errors
    };
  }
}
