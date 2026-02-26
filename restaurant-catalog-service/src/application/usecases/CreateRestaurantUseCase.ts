import { IRestaurantRepository } from '../../domain/interfaces/IRestaurantRepository';
import { Restaurant } from '../../domain/entities/Restaurant';
import { v4 as uuidv4 } from 'uuid';

export interface CreateRestaurantDTO {
  name: string;
  address: string;
  phone: string;
  email: string;
  schedule: string;
  description?: string;
  imageUrl?: string;
}

export class CreateRestaurantUseCase {
  constructor(private readonly restaurantRepository: IRestaurantRepository) {}

  async execute(dto: CreateRestaurantDTO): Promise<Restaurant> {
    console.log(`🏪 Creando restaurante: ${dto.name}`);

    const restaurant = new Restaurant({
      id: uuidv4(),
      name: dto.name,
      address: dto.address,
      phone: dto.phone,
      email: dto.email,
      schedule: dto.schedule,
      description: dto.description,
      imageUrl: dto.imageUrl,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedRestaurant = await this.restaurantRepository.save(restaurant);

    console.log(`✅ Restaurante creado: ${savedRestaurant.id}`);

    return savedRestaurant;
  }
}
