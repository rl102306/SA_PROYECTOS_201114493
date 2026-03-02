import { ValidateOrderUseCase } from '../../../application/usecases/ValidateOrderUseCase';
import { IProductRepository } from '../../../domain/interfaces/IProductRepository';
import { IRestaurantRepository } from '../../../domain/interfaces/IRestaurantRepository';

export class CatalogServiceHandler {
  constructor(
    private readonly validateOrderUseCase: ValidateOrderUseCase,
    private readonly productRepository: IProductRepository,
    private readonly restaurantRepository: IRestaurantRepository
  ) {}

  async ValidateOrder(call: any, callback: any) {
    try {
      const { restaurant_id, items } = call.request;

      console.log(`📦 Validando orden para restaurante ${restaurant_id} con ${items.length} productos`);

      const orderItems = items.map((item: any) => ({
        productId: item.product_id,
        quantity: item.quantity,
        expectedPrice: item.expected_price
      }));

      const result = await this.validateOrderUseCase.execute(
        restaurant_id,
        orderItems
      );

      const response = {
        is_valid: result.isValid,
        message: result.message,
        errors: result.errors.map(error => ({
          product_id: error.productId,
          error_type: error.errorType,
          message: error.message
        }))
      };

      callback(null, response);
    } catch (error) {
      console.error('❌ Error en ValidateOrder:', error);
      callback({
        code: 13, // INTERNAL
        message: 'Error interno del servidor al validar la orden'
      });
    }
  }

  async GetProduct(call: any, callback: any) {
    try {
      const { product_id } = call.request;

      const product = await this.productRepository.findById(product_id);

      if (!product) {
        callback(null, {
          found: false,
          product: null
        });
        return;
      }

      callback(null, {
        found: true,
        product: {
          id: product.id,
          restaurant_id: product.restaurantId,
          name: product.name,
          description: product.description,
          price: product.price,
          category: product.category,
          is_available: product.isAvailable,
          image_url: product.imageUrl || ''
        }
      });
    } catch (error) {
      console.error('❌ Error en GetProduct:', error);
      callback({
        code: 13,
        message: 'Error interno del servidor'
      });
    }
  }

  async GetRestaurantCatalog(call: any, callback: any) {
    try {
      const { restaurant_id } = call.request;

      const products = await this.productRepository.findByRestaurantId(restaurant_id);

      const productMessages = products.map(product => ({
        id: product.id,
        restaurant_id: product.restaurantId,
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        is_available: product.isAvailable,
        image_url: product.imageUrl || ''
      }));

      callback(null, {
        products: productMessages
      });
    } catch (error) {
      console.error('❌ Error en GetRestaurantCatalog:', error);
      callback({
        code: 13,
        message: 'Error interno del servidor'
      });
    }
  }

  async ListRestaurants(call: any, callback: any) {
    try {
      const { active_only } = call.request;

      const restaurants = active_only
        ? await this.restaurantRepository.findActive()
        : await this.restaurantRepository.findAll();

      const restaurantMessages = restaurants.map(r => ({
        id: r.id,
        name: r.name,
        address: r.address,
        phone: r.phone,
        email: r.email,
        description: r.description || '',
        is_active: r.isActive
      }));

      callback(null, { restaurants: restaurantMessages });
    } catch (error) {
      console.error('❌ Error en ListRestaurants:', error);
      callback({ code: 13, message: 'Error interno del servidor' });
    }
  }
}
