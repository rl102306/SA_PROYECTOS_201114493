import { Restaurant } from '../entities/Restaurant';

export interface RestaurantFilters {
  sortBy?: 'new' | 'featured' | 'best_rated';
  tags?: string[];
  hasPromotion?: boolean;
}

export interface IRestaurantRepository {
  save(restaurant: Restaurant): Promise<Restaurant>;
  findById(id: string): Promise<Restaurant | null>;
  findAll(): Promise<Restaurant[]>;
  findActive(filters?: RestaurantFilters): Promise<Restaurant[]>;
  update(restaurant: Restaurant): Promise<Restaurant>;
  delete(id: string): Promise<void>;
}
