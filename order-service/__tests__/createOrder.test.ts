/**
 * Tests del endpoint CreateOrder — CreateOrderUseCase
 * Cubre: creación exitosa, validación de DTO, fallo de validación gRPC,
 *        cálculo de total, estados iniciales y casos límite.
 */

import { CreateOrderUseCase }   from '../src/application/usecases/CreateOrderUseCase';
import { CreateOrderDTO }       from '../src/application/dtos/CreateOrderDTO';
import { IOrderRepository }     from '../src/domain/interfaces/IOrderRepository';
import { CatalogServiceClient,
         ValidationResponse }   from '../src/infrastructure/grpc/clients/CatalogServiceClient';
import { Order, OrderStatus }   from '../src/domain/entities/Order';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────
const VALID_ORDER_RESPONSE: ValidationResponse = {
  isValid:  true,
  message:  'Orden válida',
  errors:   []
};

const mockOrderRepo: jest.Mocked<Pick<IOrderRepository, 'save'>> = {
  save: jest.fn()
};

const mockCatalogClient = {
  validateOrder: jest.fn()
} as unknown as jest.Mocked<CatalogServiceClient>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const USER_ID       = 'uuuuuuuu-0000-0000-0000-000000000001';
const RESTAURANT_ID = 'rrrrrrrr-0000-0000-0000-000000000002';
const PRODUCT_ID_1  = 'pppppppp-0000-0000-0000-000000000003';
const PRODUCT_ID_2  = 'pppppppp-0000-0000-0000-000000000004';

function validDTO(overrides: Record<string, any> = {}): CreateOrderDTO {
  return new CreateOrderDTO({
    userId:          USER_ID,
    restaurantId:    RESTAURANT_ID,
    items: [
      { productId: PRODUCT_ID_1, quantity: 2, price: 50.00 },
      { productId: PRODUCT_ID_2, quantity: 1, price: 30.00 }
    ],
    deliveryAddress: 'Calle Principal 123',
    ...overrides
  });
}

function makeSavedOrder(dto: CreateOrderDTO, total: number): Order {
  return new Order({
    id:              'oooooooo-0000-0000-0000-000000000099',
    userId:          dto.userId,
    restaurantId:    dto.restaurantId,
    items:           dto.items,
    status:          OrderStatus.PENDING,
    totalAmount:     total,
    deliveryAddress: dto.deliveryAddress
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────
describe('CreateOrderUseCase', () => {
  let useCase: CreateOrderUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateOrderUseCase(
      mockOrderRepo as unknown as IOrderRepository,
      mockCatalogClient
    );
    // Por defecto: catálogo acepta y repositorio guarda
    (mockCatalogClient.validateOrder as jest.Mock).mockResolvedValue(VALID_ORDER_RESPONSE);
    (mockOrderRepo.save as jest.Mock).mockImplementation(async (order: Order) => order);
  });

  // ── Creación exitosa ───────────────────────────────────────────────────────
  describe('creación exitosa', () => {
    test('devuelve una Order con estado PENDING', async () => {
      const dto = validDTO();
      const order = await useCase.execute(dto);
      expect(order.status).toBe(OrderStatus.PENDING);
    });

    test('calcula el total correctamente: 2×Q50 + 1×Q30 = Q130', async () => {
      const dto = validDTO();
      const order = await useCase.execute(dto);
      expect(order.totalAmount).toBe(130);
    });

    test('preserva userId, restaurantId y deliveryAddress', async () => {
      const dto = validDTO();
      const order = await useCase.execute(dto);
      expect(order.userId).toBe(USER_ID);
      expect(order.restaurantId).toBe(RESTAURANT_ID);
      expect(order.deliveryAddress).toBe('Calle Principal 123');
    });

    test('llama a validateOrder con los items correctos', async () => {
      const dto = validDTO();
      await useCase.execute(dto);
      expect(mockCatalogClient.validateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: RESTAURANT_ID,
          items: expect.arrayContaining([
            expect.objectContaining({ productId: PRODUCT_ID_1, quantity: 2, expectedPrice: 50 }),
            expect.objectContaining({ productId: PRODUCT_ID_2, quantity: 1, expectedPrice: 30 })
          ])
        })
      );
    });

    test('llama a save del repositorio una vez', async () => {
      const dto = validDTO();
      await useCase.execute(dto);
      expect(mockOrderRepo.save).toHaveBeenCalledTimes(1);
    });

    test('la Order guardada tiene los mismos items que el DTO', async () => {
      const dto = validDTO();
      const order = await useCase.execute(dto);
      expect(order.items).toHaveLength(2);
      expect(order.items[0].productId).toBe(PRODUCT_ID_1);
    });
  });

  // ── Cálculo de totales ─────────────────────────────────────────────────────
  describe('cálculo de total del pedido', () => {
    test('1 producto de Q 75.50 con cantidad 1 → total Q 75.50', async () => {
      const dto = new CreateOrderDTO({
        userId: USER_ID, restaurantId: RESTAURANT_ID,
        items: [{ productId: PRODUCT_ID_1, quantity: 1, price: 75.50 }]
      });
      const order = await useCase.execute(dto);
      expect(order.totalAmount).toBe(75.50);
    });

    test('3 unidades de Q 33.33 → total Q 99.99', async () => {
      const dto = new CreateOrderDTO({
        userId: USER_ID, restaurantId: RESTAURANT_ID,
        items: [{ productId: PRODUCT_ID_1, quantity: 3, price: 33.33 }]
      });
      const order = await useCase.execute(dto);
      expect(order.totalAmount).toBeCloseTo(99.99, 2);
    });

    test('pedido con 4 items distintos suma correctamente', async () => {
      const dto = new CreateOrderDTO({
        userId: USER_ID, restaurantId: RESTAURANT_ID,
        items: [
          { productId: 'p1', quantity: 1, price: 20 },
          { productId: 'p2', quantity: 2, price: 15 },
          { productId: 'p3', quantity: 1, price: 35 },
          { productId: 'p4', quantity: 3, price: 10 }
        ]
      });
      const order = await useCase.execute(dto);
      // 20 + 30 + 35 + 30 = 115
      expect(order.totalAmount).toBe(115);
    });
  });

  // ── Fallo de validación gRPC ───────────────────────────────────────────────
  describe('fallo de validación gRPC', () => {
    test('lanza error cuando el catálogo rechaza la orden', async () => {
      (mockCatalogClient.validateOrder as jest.Mock).mockResolvedValue({
        isValid:  false,
        message:  'Producto no disponible',
        errors: [{ productId: PRODUCT_ID_1, errorType: 'NOT_FOUND', message: 'No existe' }]
      });
      const dto = validDTO();
      await expect(useCase.execute(dto)).rejects.toThrow(/Validaci.*fallida/i);
    });

    test('no llama a save si la validación falla', async () => {
      (mockCatalogClient.validateOrder as jest.Mock).mockResolvedValue({
        isValid: false, message: 'Error', errors: []
      });
      const dto = validDTO();
      await expect(useCase.execute(dto)).rejects.toThrow();
      expect(mockOrderRepo.save).not.toHaveBeenCalled();
    });

    test('lanza error si el catálogo lanza excepción de red', async () => {
      (mockCatalogClient.validateOrder as jest.Mock).mockRejectedValue(
        new Error('Error de comunicación con Catalog Service: connection refused')
      );
      const dto = validDTO();
      await expect(useCase.execute(dto)).rejects.toThrow(/comunicaci/i);
    });
  });

  // ── Validación del DTO ─────────────────────────────────────────────────────
  describe('validación del DTO', () => {
    test('lanza error si userId está vacío', async () => {
      const dto = new CreateOrderDTO({
        userId: '', restaurantId: RESTAURANT_ID,
        items: [{ productId: PRODUCT_ID_1, quantity: 1, price: 50 }]
      });
      await expect(useCase.execute(dto)).rejects.toThrow(/Errores de validaci/i);
    });

    test('lanza error si restaurantId está vacío', async () => {
      const dto = new CreateOrderDTO({
        userId: USER_ID, restaurantId: '',
        items: [{ productId: PRODUCT_ID_1, quantity: 1, price: 50 }]
      });
      await expect(useCase.execute(dto)).rejects.toThrow(/Errores de validaci/i);
    });

    test('lanza error si no hay items', async () => {
      const dto = new CreateOrderDTO({
        userId: USER_ID, restaurantId: RESTAURANT_ID, items: []
      });
      await expect(useCase.execute(dto)).rejects.toThrow(/Errores de validaci/i);
    });

    test('lanza error si un item tiene cantidad 0', async () => {
      const dto = new CreateOrderDTO({
        userId: USER_ID, restaurantId: RESTAURANT_ID,
        items: [{ productId: PRODUCT_ID_1, quantity: 0, price: 50 }]
      });
      await expect(useCase.execute(dto)).rejects.toThrow(/Errores de validaci/i);
    });

    test('lanza error si un item tiene precio negativo', async () => {
      const dto = new CreateOrderDTO({
        userId: USER_ID, restaurantId: RESTAURANT_ID,
        items: [{ productId: PRODUCT_ID_1, quantity: 1, price: -10 }]
      });
      await expect(useCase.execute(dto)).rejects.toThrow(/Errores de validaci/i);
    });

    test('no llama a validateOrder si el DTO es inválido', async () => {
      const dto = new CreateOrderDTO({ userId: '', restaurantId: '', items: [] });
      await expect(useCase.execute(dto)).rejects.toThrow();
      expect(mockCatalogClient.validateOrder).not.toHaveBeenCalled();
    });
  });

  // ── Entidad Order ──────────────────────────────────────────────────────────
  describe('Order entity — domain methods', () => {
    test('updateStatus cambia el estado correctamente', () => {
      const order = makeSavedOrder(validDTO(), 130);
      order.updateStatus(OrderStatus.CONFIRMED);
      expect(order.status).toBe(OrderStatus.CONFIRMED);
    });

    test('cancel() cambia estado a CANCELLED', () => {
      const order = makeSavedOrder(validDTO(), 130);
      order.cancel();
      expect(order.status).toBe(OrderStatus.CANCELLED);
    });

    test('cancel() lanza error si el pedido ya fue entregado', () => {
      const order = makeSavedOrder(validDTO(), 130);
      order.updateStatus(OrderStatus.DELIVERED);
      expect(() => order.cancel()).toThrow('No se puede cancelar una orden ya entregada');
    });

    test('calculateTotal() retorna suma de items', () => {
      const order = makeSavedOrder(validDTO(), 130);
      expect(order.calculateTotal()).toBe(130);
    });
  });
});
