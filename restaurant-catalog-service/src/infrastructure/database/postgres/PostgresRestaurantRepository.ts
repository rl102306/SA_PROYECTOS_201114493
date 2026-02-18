import { Pool } from 'pg';
import { IRestaurantRepository } from '../../../domain/interfaces/IRestaurantRepository';
import { Restaurant } from '../../../domain/entities/Restaurant';

export class PostgresRestaurantRepository implements IRestaurantRepository {
  constructor(private readonly pool: Pool) {}

  async save(restaurant: Restaurant): Promise<Restaurant> {
    const query = `
      INSERT INTO restaurants (
        id, name, address, phone, email, schedule, description, 
        image_url, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      restaurant.id,
      restaurant.name,
      restaurant.address,
      restaurant.phone,
      restaurant.email,
      restaurant.schedule,
      restaurant.description || null,
      restaurant.imageUrl || null,
      restaurant.isActive,
      restaurant.createdAt,
      restaurant.updatedAt
    ];

    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Restaurant | null> {
    const result = await this.pool.query(
      'SELECT * FROM restaurants WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToEntity(result.rows[0]);
  }

  async findAll(): Promise<Restaurant[]> {
    const result = await this.pool.query(
      'SELECT * FROM restaurants ORDER BY name ASC'
    );

    return result.rows.map(row => this.mapToEntity(row));
  }

  async findActive(): Promise<Restaurant[]> {
    const result = await this.pool.query(
      'SELECT * FROM restaurants WHERE is_active = true ORDER BY name ASC'
    );

    return result.rows.map(row => this.mapToEntity(row));
  }

  async update(restaurant: Restaurant): Promise<Restaurant> {
    const query = `
      UPDATE restaurants SET
        name = $2,
        address = $3,
        phone = $4,
        email = $5,
        schedule = $6,
        description = $7,
        image_url = $8,
        is_active = $9,
        updated_at = $10
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      restaurant.id,
      restaurant.name,
      restaurant.address,
      restaurant.phone,
      restaurant.email,
      restaurant.schedule,
      restaurant.description || null,
      restaurant.imageUrl || null,
      restaurant.isActive,
      restaurant.updatedAt
    ];

    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM restaurants WHERE id = $1', [id]);
  }

  private mapToEntity(row: any): Restaurant {
    return new Restaurant({
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      email: row.email,
      schedule: row.schedule,
      description: row.description,
      imageUrl: row.image_url,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
