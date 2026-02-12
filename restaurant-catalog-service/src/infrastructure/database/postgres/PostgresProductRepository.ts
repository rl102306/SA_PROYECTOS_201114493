import { Pool } from 'pg';
import { Product } from '../../../domain/entities/Product';
import { IProductRepository } from '../../../domain/interfaces/IProductRepository';

export class PostgresProductRepository implements IProductRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Product | null> {
    const result = await this.pool.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToEntity(result.rows[0]);
  }

  async findByRestaurantId(restaurantId: string): Promise<Product[]> {
    const result = await this.pool.query(
      'SELECT * FROM products WHERE restaurant_id = $1',
      [restaurantId]
    );

    return result.rows.map(row => this.mapToEntity(row));
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    const result = await this.pool.query(
      'SELECT * FROM products WHERE id = ANY($1)',
      [ids]
    );

    return result.rows.map(row => this.mapToEntity(row));
  }

  async save(product: Product): Promise<Product> {
    const query = `
      INSERT INTO products (id, restaurant_id, name, description, price, category, is_available, image_url, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        restaurant_id = EXCLUDED.restaurant_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        category = EXCLUDED.category,
        is_available = EXCLUDED.is_available,
        image_url = EXCLUDED.image_url,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    const values = [
      product.id,
      product.restaurantId,
      product.name,
      product.description,
      product.price,
      product.category,
      product.isAvailable,
      product.imageUrl || null,
      product.createdAt,
      product.updatedAt
    ];

    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM products WHERE id = $1', [id]);
  }

  private mapToEntity(row: any): Product {
    return new Product({
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price),
      category: row.category,
      isAvailable: row.is_available,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
}
