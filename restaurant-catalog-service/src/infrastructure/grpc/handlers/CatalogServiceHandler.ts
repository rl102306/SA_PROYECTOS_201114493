import { ValidateOrderUseCase } from '../../../application/usecases/ValidateOrderUseCase';
import { IProductRepository } from '../../../domain/interfaces/IProductRepository';
import { IRestaurantRepository } from '../../../domain/interfaces/IRestaurantRepository';
import { Product } from '../../../domain/entities/Product';
import { Restaurant } from '../../../domain/entities/Restaurant';

export class CatalogServiceHandler {
  constructor(
    private readonly validateOrderUseCase: ValidateOrderUseCase,
    private readonly productRepository: IProductRepository,
    private readonly restaurantRepository: IRestaurantRepository
  ) {}

  async ValidateOrder(call: any, callback: any) {
    try {
      const { restaurant_id, items } = call.request;
      const orderItems = items.map((item: any) => ({
        productId: item.product_id,
        quantity: item.quantity,
        expectedPrice: item.expected_price
      }));
      const result = await this.validateOrderUseCase.execute(restaurant_id, orderItems);
      callback(null, {
        is_valid: result.isValid,
        message: result.message,
        errors: result.errors.map(e => ({ product_id: e.productId, error_type: e.errorType, message: e.message }))
      });
    } catch (error) {
      console.error('❌ Error en ValidateOrder:', error);
      callback({ code: 13, message: 'Error interno del servidor al validar la orden' });
    }
  }

  async GetProduct(call: any, callback: any) {
    try {
      const { product_id } = call.request;
      const product = await this.productRepository.findById(product_id);
      if (!product) { callback(null, { found: false, product: null }); return; }
      callback(null, { found: true, product: this.mapProduct(product) });
    } catch (error) {
      console.error('❌ Error en GetProduct:', error);
      callback({ code: 13, message: 'Error interno del servidor' });
    }
  }

  async GetRestaurantCatalog(call: any, callback: any) {
    try {
      const { restaurant_id } = call.request;
      const products = await this.productRepository.findByRestaurantId(restaurant_id);
      callback(null, { products: products.map(p => this.mapProduct(p)) });
    } catch (error) {
      console.error('❌ Error en GetRestaurantCatalog:', error);
      callback({ code: 13, message: 'Error interno del servidor' });
    }
  }

  async ListRestaurants(call: any, callback: any) {
    try {
      const { active_only } = call.request;
      const restaurants = active_only
        ? await this.restaurantRepository.findActive()
        : await this.restaurantRepository.findAll();
      callback(null, {
        restaurants: restaurants.map(r => ({
          id: r.id, name: r.name, address: r.address,
          phone: r.phone, email: r.email,
          description: r.description || '', is_active: r.isActive
        }))
      });
    } catch (error) {
      console.error('❌ Error en ListRestaurants:', error);
      callback({ code: 13, message: 'Error interno del servidor' });
    }
  }

  async CreateProduct(call: any, callback: any) {
    try {
      const { restaurant_id, name, description, price, category, is_available } = call.request;
      const product = new Product({
        restaurantId: restaurant_id,
        name,
        description: description || '',
        price,
        category: category || '',
        isAvailable: is_available !== false
      });
      const saved = await this.productRepository.save(product);
      callback(null, { success: true, message: 'Producto creado exitosamente', product: this.mapProduct(saved) });
    } catch (error: any) {
      console.error('❌ Error en CreateProduct:', error);
      callback(null, { success: false, message: error.message || 'Error al crear producto', product: null });
    }
  }

  async UpdateProduct(call: any, callback: any) {
    try {
      const { id, restaurant_id, name, description, price, category, is_available } = call.request;
      const existing = await this.productRepository.findById(id);
      if (!existing) { callback(null, { success: false, message: 'Producto no encontrado', product: null }); return; }
      if (existing.restaurantId !== restaurant_id) {
        callback(null, { success: false, message: 'El producto no pertenece a este restaurante', product: null }); return;
      }
      const updated = new Product({
        id: existing.id,
        restaurantId: existing.restaurantId,
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        price: price !== undefined ? price : existing.price,
        category: category || existing.category,
        isAvailable: is_available !== undefined ? is_available : existing.isAvailable,
        imageUrl: existing.imageUrl,
        createdAt: existing.createdAt,
        updatedAt: new Date()
      });
      const saved = await this.productRepository.save(updated);
      callback(null, { success: true, message: 'Producto actualizado exitosamente', product: this.mapProduct(saved) });
    } catch (error: any) {
      console.error('❌ Error en UpdateProduct:', error);
      callback(null, { success: false, message: error.message || 'Error al actualizar producto', product: null });
    }
  }

  async DeleteProduct(call: any, callback: any) {
    try {
      const { id, restaurant_id } = call.request;
      const existing = await this.productRepository.findById(id);
      if (!existing) { callback(null, { success: false, message: 'Producto no encontrado' }); return; }
      if (existing.restaurantId !== restaurant_id) {
        callback(null, { success: false, message: 'El producto no pertenece a este restaurante' }); return;
      }
      await this.productRepository.delete(id);
      callback(null, { success: true, message: 'Producto eliminado exitosamente' });
    } catch (error: any) {
      console.error('❌ Error en DeleteProduct:', error);
      callback(null, { success: false, message: error.message || 'Error al eliminar producto' });
    }
  }

  async CreateRestaurant(call: any, callback: any) {
    try {
      const { id, name, email } = call.request;
      const existing = await this.restaurantRepository.findById(id);
      if (existing) {
        callback(null, { success: true, message: 'El restaurante ya existe' });
        return;
      }
      const restaurant = new Restaurant({
        id,
        name: name || 'Mi Restaurante',
        address: '',
        phone: '',
        email: email || '',
        schedule: '',
        description: '',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await this.restaurantRepository.save(restaurant);
      callback(null, { success: true, message: 'Restaurante creado exitosamente' });
    } catch (error: any) {
      console.error('❌ Error en CreateRestaurant:', error);
      callback(null, { success: false, message: error.message || 'Error al crear restaurante' });
    }
  }

  private mapProduct(p: Product) {
    return {
      id: p.id, restaurant_id: p.restaurantId,
      name: p.name, description: p.description,
      price: p.price, category: p.category,
      is_available: p.isAvailable, image_url: p.imageUrl || ''
    };
  }
}
