import { ValidateOrderUseCase } from '../../../application/usecases/ValidateOrderUseCase';
import { IProductRepository } from '../../../domain/interfaces/IProductRepository';
import { IRestaurantRepository, RestaurantFilters } from '../../../domain/interfaces/IRestaurantRepository';
import { IPromotionRepository } from '../../../domain/interfaces/IPromotionRepository';
import { ICouponRepository } from '../../../domain/interfaces/ICouponRepository';
import { IRatingRepository } from '../../../domain/interfaces/IRatingRepository';
import { INotificationRepository } from '../../../domain/interfaces/INotificationRepository';
import { Product } from '../../../domain/entities/Product';
import { Restaurant } from '../../../domain/entities/Restaurant';
import { Promotion, PromotionType } from '../../../domain/entities/Promotion';
import { Coupon, DiscountType } from '../../../domain/entities/Coupon';
import { Rating, RatingType } from '../../../domain/entities/Rating';

export class CatalogServiceHandler {
  constructor(
    private readonly validateOrderUseCase: ValidateOrderUseCase,
    private readonly productRepository: IProductRepository,
    private readonly restaurantRepository: IRestaurantRepository,
    private readonly promotionRepository: IPromotionRepository,
    private readonly couponRepository: ICouponRepository,
    private readonly ratingRepository: IRatingRepository,
    private readonly notificationRepository: INotificationRepository
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
        errors: result.errors.map((e: any) => ({ product_id: e.productId, error_type: e.errorType, message: e.message }))
      });
    } catch (error) {
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
      callback({ code: 13, message: 'Error interno del servidor' });
    }
  }

  async GetRestaurantCatalog(call: any, callback: any) {
    try {
      const { restaurant_id } = call.request;
      const products = await this.productRepository.findByRestaurantId(restaurant_id);
      callback(null, { products: products.map((p: Product) => this.mapProduct(p)) });
    } catch (error) {
      callback({ code: 13, message: 'Error interno del servidor' });
    }
  }

  async ListRestaurants(call: any, callback: any) {
    try {
      const { active_only, sort_by, tags, has_promotion } = call.request;
      const filters: RestaurantFilters = {
        sortBy: sort_by || undefined,
        tags: tags && tags.length > 0 ? tags : undefined,
        hasPromotion: has_promotion || false
      };
      const restaurants = active_only
        ? await this.restaurantRepository.findActive(filters)
        : await this.restaurantRepository.findAll();

      const enriched = await Promise.all(restaurants.map(async r => {
        const summary = await this.ratingRepository.getRestaurantSummary(r.id).catch(() => ({ averageStars: 0, totalRatings: 0 }));
        return {
          id: r.id, name: r.name, address: r.address,
          phone: r.phone, email: r.email,
          description: r.description || '', is_active: r.isActive,
          tags: r.tags,
          avg_rating: summary.averageStars,
          total_ratings: summary.totalRatings
        };
      }));

      callback(null, { restaurants: enriched });
    } catch (error) {
      console.error('❌ Error en ListRestaurants:', error);
      callback({ code: 13, message: 'Error interno del servidor' });
    }
  }

  async CreateProduct(call: any, callback: any) {
    try {
      const { restaurant_id, name, description, price, category, is_available } = call.request;
      const product = new Product({
        restaurantId: restaurant_id, name,
        description: description || '', price,
        category: category || '', isAvailable: is_available !== false
      });
      const saved = await this.productRepository.save(product);
      callback(null, { success: true, message: 'Producto creado exitosamente', product: this.mapProduct(saved) });
    } catch (error: any) {
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
        id: existing.id, restaurantId: existing.restaurantId,
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        price: price !== undefined ? price : existing.price,
        category: category || existing.category,
        isAvailable: is_available !== undefined ? is_available : existing.isAvailable,
        imageUrl: existing.imageUrl, createdAt: existing.createdAt, updatedAt: new Date()
      });
      const saved = await this.productRepository.save(updated);
      callback(null, { success: true, message: 'Producto actualizado exitosamente', product: this.mapProduct(saved) });
    } catch (error: any) {
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
      callback(null, { success: false, message: error.message || 'Error al eliminar producto' });
    }
  }

  async CreateRestaurant(call: any, callback: any) {
    try {
      const { id, name, email } = call.request;
      const existing = await this.restaurantRepository.findById(id);
      if (existing) { callback(null, { success: true, message: 'El restaurante ya existe' }); return; }
      const restaurant = new Restaurant({
        id, name: name || 'Mi Restaurante', address: '', phone: '',
        email: email || '', schedule: '', description: '',
        isActive: true, tags: [], createdAt: new Date(), updatedAt: new Date()
      });
      await this.restaurantRepository.save(restaurant);
      callback(null, { success: true, message: 'Restaurante creado exitosamente' });
    } catch (error: any) {
      callback(null, { success: false, message: error.message || 'Error al crear restaurante' });
    }
  }

  // ===== PROMOTIONS =====
  async CreatePromotion(call: any, callback: any) {
    try {
      const { restaurant_id, title, description, type, discount_value, starts_at, ends_at } = call.request;
      const promotion = new Promotion({
        restaurantId: restaurant_id, title,
        description: description || '',
        type: (type || 'PERCENTAGE') as PromotionType,
        discountValue: discount_value,
        isActive: true,
        startsAt: new Date(starts_at),
        endsAt: new Date(ends_at)
      });
      const saved = await this.promotionRepository.save(promotion);
      callback(null, { success: true, message: 'Promoción creada exitosamente', promotion: this.mapPromotion(saved) });
    } catch (error: any) {
      callback(null, { success: false, message: error.message || 'Error al crear promoción', promotion: null });
    }
  }

  async ListPromotions(call: any, callback: any) {
    try {
      const { restaurant_id, active_only } = call.request;
      const promotions = active_only
        ? await this.promotionRepository.findActiveByRestaurantId(restaurant_id)
        : await this.promotionRepository.findByRestaurantId(restaurant_id);
      callback(null, { success: true, promotions: promotions.map((p: Promotion) => this.mapPromotion(p)) });
    } catch (error: any) {
      callback(null, { success: false, promotions: [] });
    }
  }

  async DeletePromotion(call: any, callback: any) {
    try {
      const { id, restaurant_id } = call.request;
      const existing = await this.promotionRepository.findById(id);
      if (!existing) { callback(null, { success: false, message: 'Promoción no encontrada' }); return; }
      if (existing.restaurantId !== restaurant_id) {
        callback(null, { success: false, message: 'La promoción no pertenece a este restaurante' }); return;
      }
      await this.promotionRepository.delete(id);
      callback(null, { success: true, message: 'Promoción eliminada exitosamente' });
    } catch (error: any) {
      callback(null, { success: false, message: error.message || 'Error al eliminar promoción' });
    }
  }

  // ===== COUPONS =====
  async CreateCoupon(call: any, callback: any) {
    try {
      const { restaurant_id, code, description, type, discount_value, min_order_amount, max_uses, expires_at } = call.request;
      const existing = await this.couponRepository.findByCode(code);
      if (existing) { callback(null, { success: false, message: 'Ya existe un cupón con ese código', coupon: null }); return; }
      const coupon = new Coupon({
        restaurantId: restaurant_id, code,
        description: description || '',
        type: (type || 'PERCENTAGE') as DiscountType,
        discountValue: discount_value,
        minOrderAmount: min_order_amount || 0,
        maxUses: max_uses || undefined,
        usesCount: 0,
        isApproved: false,
        isActive: true,
        expiresAt: new Date(expires_at)
      });
      const saved = await this.couponRepository.save(coupon);
      callback(null, { success: true, message: 'Cupón creado. Pendiente de aprobación del administrador.', coupon: this.mapCoupon(saved) });
    } catch (error: any) {
      callback(null, { success: false, message: error.message || 'Error al crear cupón', coupon: null });
    }
  }

  async ListCoupons(call: any, callback: any) {
    try {
      const { restaurant_id } = call.request;
      const coupons = await this.couponRepository.findByRestaurantId(restaurant_id);
      callback(null, { success: true, coupons: coupons.map((c: Coupon) => this.mapCoupon(c)) });
    } catch (error: any) {
      callback(null, { success: false, coupons: [] });
    }
  }

  async ApproveCoupon(call: any, callback: any) {
    try {
      const { id } = call.request;
      const coupon = await this.couponRepository.findById(id);
      if (!coupon) { callback(null, { success: false, message: 'Cupón no encontrado', coupon: null }); return; }
      coupon.approve();
      const saved = await this.couponRepository.save(coupon);
      callback(null, { success: true, message: 'Cupón aprobado exitosamente', coupon: this.mapCoupon(saved) });
    } catch (error: any) {
      callback(null, { success: false, message: error.message || 'Error al aprobar cupón', coupon: null });
    }
  }

  async ValidateCoupon(call: any, callback: any) {
    try {
      const { code, order_amount } = call.request;
      const coupon = await this.couponRepository.findByCode(code);
      if (!coupon) {
        callback(null, { valid: false, message: 'Cupón no encontrado', discount_amount: 0, coupon: null }); return;
      }
      const result = coupon.validate(order_amount);
      callback(null, {
        valid: result.valid,
        message: result.message,
        discount_amount: result.discountAmount,
        coupon: this.mapCoupon(coupon)
      });
    } catch (error: any) {
      callback(null, { valid: false, message: error.message || 'Error al validar cupón', discount_amount: 0, coupon: null });
    }
  }

  async ListPendingCoupons(call: any, callback: any) {
    try {
      const coupons = await this.couponRepository.findPendingApproval();
      callback(null, { success: true, coupons: coupons.map((c: Coupon) => this.mapCoupon(c)) });
    } catch (error: any) {
      callback(null, { success: false, coupons: [] });
    }
  }

  // ===== RATINGS =====
  async CreateRating(call: any, callback: any) {
    try {
      const { order_id, user_id, restaurant_id, delivery_person_id, product_id, type, stars, comment, recommended } = call.request;
      const rating = new Rating({
        orderId: order_id, userId: user_id,
        restaurantId: restaurant_id || undefined,
        deliveryPersonId: delivery_person_id || undefined,
        productId: product_id || undefined,
        type: (type || 'RESTAURANT') as RatingType,
        stars: stars || undefined,
        comment: comment || undefined,
        recommended: type === 'PRODUCT' ? recommended : undefined
      });
      await this.ratingRepository.save(rating);
      callback(null, { success: true, message: 'Calificación registrada exitosamente' });
    } catch (error: any) {
      callback(null, { success: false, message: error.message || 'Error al registrar calificación' });
    }
  }

  async GetRestaurantRating(call: any, callback: any) {
    try {
      const { restaurant_id } = call.request;
      const summary = await this.ratingRepository.getRestaurantSummary(restaurant_id);
      callback(null, {
        restaurant_id: summary.restaurantId,
        average_stars: summary.averageStars,
        total_ratings: summary.totalRatings
      });
    } catch (error: any) {
      callback(null, { restaurant_id: call.request.restaurant_id, average_stars: 0, total_ratings: 0 });
    }
  }

  async GetProductRating(call: any, callback: any) {
    try {
      const { product_id } = call.request;
      const summary = await this.ratingRepository.getProductSummary(product_id);
      callback(null, {
        product_id: summary.productId,
        recommended_count: summary.recommendedCount,
        not_recommended_count: summary.notRecommendedCount,
        total_ratings: summary.totalRatings,
        recommendation_rate: summary.recommendationRate
      });
    } catch (error: any) {
      callback(null, { product_id: call.request.product_id, recommended_count: 0, not_recommended_count: 0, total_ratings: 0, recommendation_rate: 0 });
    }
  }

  async GetDeliveryPersonRating(call: any, callback: any) {
    try {
      const { delivery_person_id } = call.request;
      const summary = await this.ratingRepository.getDeliveryPersonSummary(delivery_person_id);
      callback(null, {
        delivery_person_id: summary.deliveryPersonId,
        average_stars: summary.averageStars,
        total_ratings: summary.totalRatings
      });
    } catch (error: any) {
      callback(null, { delivery_person_id: call.request.delivery_person_id, average_stars: 0, total_ratings: 0 });
    }
  }

  // ===== NOTIFICATIONS =====
  async GetRestaurantNotifications(call: any, callback: any) {
    try {
      const { restaurant_id, unread_only } = call.request;
      const notifications = await this.notificationRepository.findByRestaurantId(restaurant_id, unread_only);
      const unreadCount = notifications.filter((n: any) => !n.isRead).length;
      callback(null, {
        success: true,
        notifications: notifications.map((n: any) => ({
          id: n.id,
          restaurant_id: n.restaurantId,
          order_id: n.orderId,
          user_id: n.userId,
          total_amount: n.totalAmount,
          delivery_address: n.deliveryAddress,
          items_json: JSON.stringify(n.items),
          is_read: n.isRead,
          created_at: n.createdAt.toISOString()
        })),
        unread_count: unreadCount
      });
    } catch (error: any) {
      callback(null, { success: false, notifications: [], unread_count: 0 });
    }
  }

  async MarkNotificationsRead(call: any, callback: any) {
    try {
      const { restaurant_id, notification_id } = call.request;
      if (notification_id) {
        await this.notificationRepository.markAsRead(notification_id);
      } else {
        await this.notificationRepository.markAllAsRead(restaurant_id);
      }
      callback(null, { success: true });
    } catch (error: any) {
      callback(null, { success: false });
    }
  }

  // ===== HELPERS =====
  private mapProduct(p: Product) {
    return {
      id: p.id, restaurant_id: p.restaurantId,
      name: p.name, description: p.description,
      price: p.price, category: p.category,
      is_available: p.isAvailable, image_url: p.imageUrl || ''
    };
  }

  private mapPromotion(p: Promotion) {
    return {
      id: p.id, restaurant_id: p.restaurantId,
      title: p.title, description: p.description || '',
      type: p.type, discount_value: p.discountValue,
      is_active: p.isActive,
      starts_at: p.startsAt.toISOString(),
      ends_at: p.endsAt.toISOString()
    };
  }

  private mapCoupon(c: Coupon) {
    return {
      id: c.id, restaurant_id: c.restaurantId,
      code: c.code, description: c.description || '',
      type: c.type, discount_value: c.discountValue,
      min_order_amount: c.minOrderAmount,
      max_uses: c.maxUses || 0,
      uses_count: c.usesCount,
      is_approved: c.isApproved,
      is_active: c.isActive,
      expires_at: c.expiresAt.toISOString()
    };
  }
}
