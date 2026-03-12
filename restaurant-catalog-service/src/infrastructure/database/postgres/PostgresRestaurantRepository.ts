import { Pool } from 'pg';
import { IRestaurantRepository, RestaurantFilters } from '../../../domain/interfaces/IRestaurantRepository';
import { Restaurant } from '../../../domain/entities/Restaurant';

export class PostgresRestaurantRepository implements IRestaurantRepository {
  constructor(private readonly pool: Pool) {}

  async save(restaurant: Restaurant): Promise<Restaurant> {
    const query = `
      INSERT INTO restaurants (
        id, name, address, phone, email, schedule, description,
        image_url, is_active, tags, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        schedule = EXCLUDED.schedule,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        is_active = EXCLUDED.is_active,
        tags = EXCLUDED.tags,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;
    const values = [
      restaurant.id, restaurant.name, restaurant.address,
      restaurant.phone, restaurant.email, restaurant.schedule,
      restaurant.description || null, restaurant.imageUrl || null,
      restaurant.isActive, restaurant.tags, restaurant.createdAt, restaurant.updatedAt
    ];
    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Restaurant | null> {
    const result = await this.pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async findAll(): Promise<Restaurant[]> {
    const result = await this.pool.query('SELECT * FROM restaurants ORDER BY name ASC');
    return result.rows.map(row => this.mapToEntity(row));
  }

  async findActive(filters?: RestaurantFilters): Promise<Restaurant[]> {
    const params: any[] = [];

    // Build base query depending on sort
    let selectClause = 'SELECT r.*';
    let fromClause = 'FROM restaurants r';
    let joinClause = '';
    let whereClause = 'WHERE r.is_active = true';
    let orderClause = 'ORDER BY r.name ASC';

    if (filters?.sortBy === 'featured') {
      selectClause = 'SELECT r.*, COALESCE(o.order_count, 0) as order_count';
      joinClause = `LEFT JOIN (
        SELECT restaurant_id, COUNT(*) as order_count
        FROM restaurant_order_notifications
        GROUP BY restaurant_id
      ) o ON r.id = o.restaurant_id`;
      orderClause = 'ORDER BY order_count DESC, r.name ASC';
    } else if (filters?.sortBy === 'best_rated') {
      selectClause = 'SELECT r.*, COALESCE(rt.avg_stars, 0) as avg_stars, COALESCE(rt.rating_count, 0) as rating_count';
      joinClause = `LEFT JOIN (
        SELECT restaurant_id, AVG(stars) as avg_stars, COUNT(*) as rating_count
        FROM ratings
        WHERE type = 'RESTAURANT' AND stars IS NOT NULL
        GROUP BY restaurant_id
      ) rt ON r.id = rt.restaurant_id`;
      orderClause = 'ORDER BY avg_stars DESC, rating_count DESC, r.name ASC';
    } else if (filters?.sortBy === 'new') {
      orderClause = 'ORDER BY r.created_at DESC';
    }

    if (filters?.hasPromotion) {
      whereClause += ` AND r.id IN (
        SELECT DISTINCT restaurant_id FROM promotions
        WHERE is_active = true AND starts_at <= NOW() AND ends_at >= NOW()
      )`;
    }

    if (filters?.tags && filters.tags.length > 0) {
      params.push(filters.tags);
      whereClause += ` AND r.tags && $${params.length}::text[]`;
    }

    const query = `${selectClause} ${fromClause} ${joinClause} ${whereClause} ${orderClause}`;
    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapToEntity(row));
  }

  async update(restaurant: Restaurant): Promise<Restaurant> {
    const query = `
      UPDATE restaurants SET
        name = $2, address = $3, phone = $4, email = $5,
        schedule = $6, description = $7, image_url = $8,
        is_active = $9, tags = $10, updated_at = $11
      WHERE id = $1
      RETURNING *
    `;
    const values = [
      restaurant.id, restaurant.name, restaurant.address,
      restaurant.phone, restaurant.email, restaurant.schedule,
      restaurant.description || null, restaurant.imageUrl || null,
      restaurant.isActive, restaurant.tags, restaurant.updatedAt
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
      tags: row.tags || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
