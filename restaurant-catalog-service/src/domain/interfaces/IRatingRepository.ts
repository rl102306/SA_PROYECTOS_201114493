import { Rating } from '../entities/Rating';

export interface RestaurantRatingSummary {
  restaurantId: string;
  averageStars: number;
  totalRatings: number;
}

export interface ProductRatingSummary {
  productId: string;
  recommendedCount: number;
  notRecommendedCount: number;
  totalRatings: number;
  recommendationRate: number;
}

export interface DeliveryPersonRatingSummary {
  deliveryPersonId: string;
  averageStars: number;
  totalRatings: number;
}

export interface IRatingRepository {
  save(rating: Rating): Promise<Rating>;
  findByOrderId(orderId: string): Promise<Rating[]>;
  findByRestaurantId(restaurantId: string): Promise<Rating[]>;
  findByProductId(productId: string): Promise<Rating[]>;
  getRestaurantSummary(restaurantId: string): Promise<RestaurantRatingSummary>;
  getProductSummary(productId: string): Promise<ProductRatingSummary>;
  getTopRatedRestaurants(limit: number): Promise<RestaurantRatingSummary[]>;
  getDeliveryPersonSummary(deliveryPersonId: string): Promise<DeliveryPersonRatingSummary>;
}
