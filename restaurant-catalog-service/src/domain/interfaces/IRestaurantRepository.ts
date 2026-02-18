import { Restaurant } from '../entities/Restaurant';

export interface IRestaurantRepository {
  save(restaurant: Restaurant): Promise<Restaurant>;
  findById(id: string): Promise<Restaurant | null>;
  findAll(): Promise<Restaurant[]>;
  findActive(): Promise<Restaurant[]>;
  update(restaurant: Restaurant): Promise<Restaurant>;
  delete(id: string): Promise<void>;
}
