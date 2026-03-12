import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/catalog.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});

const catalogProto = grpc.loadPackageDefinition(packageDefinition).catalog as any;

export class CatalogServiceClient {
  private client: any;

  constructor() {
    const url = process.env.CATALOG_SERVICE_URL || 'localhost:50051';
    console.log(`🔗 Conectando a Catalog Service en: ${url}`);
    this.client = new catalogProto.CatalogService(url, grpc.credentials.createInsecure());
  }

  private call<T>(method: string, request: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.client[method](request, (error: any, response: any) => {
        if (error) { reject(error); return; }
        resolve(response);
      });
    });
  }

  listRestaurants(activeOnly = true, filters?: { sortBy?: string; tags?: string[]; hasPromotion?: boolean }): Promise<any> {
    return this.call('ListRestaurants', {
      active_only: activeOnly,
      sort_by: filters?.sortBy || '',
      tags: filters?.tags || [],
      has_promotion: filters?.hasPromotion || false
    });
  }

  getRestaurantCatalog(restaurantId: string): Promise<any> {
    return this.call('GetRestaurantCatalog', { restaurant_id: restaurantId });
  }

  getProduct(productId: string): Promise<any> {
    return this.call('GetProduct', { product_id: productId });
  }

  createProduct(data: any): Promise<any> {
    return this.call('CreateProduct', data);
  }

  updateProduct(data: any): Promise<any> {
    return this.call('UpdateProduct', data);
  }

  deleteProduct(id: string, restaurantId: string): Promise<any> {
    return this.call('DeleteProduct', { id, restaurant_id: restaurantId });
  }

  createRestaurant(data: { id: string; name: string; email: string }): Promise<any> {
    return this.call('CreateRestaurant', data);
  }

  // Promotions
  createPromotion(data: any): Promise<any> {
    return this.call('CreatePromotion', data);
  }

  listPromotions(restaurantId: string, activeOnly = false): Promise<any> {
    return this.call('ListPromotions', { restaurant_id: restaurantId, active_only: activeOnly });
  }

  deletePromotion(id: string, restaurantId: string): Promise<any> {
    return this.call('DeletePromotion', { id, restaurant_id: restaurantId });
  }

  // Coupons
  createCoupon(data: any): Promise<any> {
    return this.call('CreateCoupon', data);
  }

  listCoupons(restaurantId: string): Promise<any> {
    return this.call('ListCoupons', { restaurant_id: restaurantId });
  }

  approveCoupon(id: string): Promise<any> {
    return this.call('ApproveCoupon', { id });
  }

  validateCoupon(code: string, orderAmount: number): Promise<any> {
    return this.call('ValidateCoupon', { code, order_amount: orderAmount });
  }

  listPendingCoupons(): Promise<any> {
    return this.call('ListPendingCoupons', {});
  }

  // Ratings
  createRating(data: any): Promise<any> {
    return this.call('CreateRating', data);
  }

  getRestaurantRating(restaurantId: string): Promise<any> {
    return this.call('GetRestaurantRating', { restaurant_id: restaurantId });
  }

  getProductRating(productId: string): Promise<any> {
    return this.call('GetProductRating', { product_id: productId });
  }

  // Notifications
  getRestaurantNotifications(restaurantId: string, unreadOnly = false): Promise<any> {
    return this.call('GetRestaurantNotifications', { restaurant_id: restaurantId, unread_only: unreadOnly });
  }

  markNotificationsRead(restaurantId: string, notificationId?: string): Promise<any> {
    return this.call('MarkNotificationsRead', { restaurant_id: restaurantId, notification_id: notificationId || '' });
  }
}

export const catalogServiceClient = new CatalogServiceClient();
