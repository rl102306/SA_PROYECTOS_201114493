import { Pool } from 'pg';
import { IPromotionRepository } from '../../../domain/interfaces/IPromotionRepository';
import { Promotion, PromotionType } from '../../../domain/entities/Promotion';
import { v4 as uuidv4 } from 'uuid';

export class PostgresPromotionRepository implements IPromotionRepository {
  constructor(private readonly pool: Pool) {}

  async save(promotion: Promotion): Promise<Promotion> {
    const query = `
      INSERT INTO promotions (id, restaurant_id, title, description, type, discount_value, is_active, starts_at, ends_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        type = EXCLUDED.type,
        discount_value = EXCLUDED.discount_value,
        is_active = EXCLUDED.is_active,
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;
    const values = [
      promotion.id, promotion.restaurantId, promotion.title,
      promotion.description || null, promotion.type, promotion.discountValue,
      promotion.isActive, promotion.startsAt, promotion.endsAt,
      promotion.createdAt, promotion.updatedAt
    ];
    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Promotion | null> {
    const result = await this.pool.query('SELECT * FROM promotions WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async findByRestaurantId(restaurantId: string): Promise<Promotion[]> {
    const result = await this.pool.query(
      'SELECT * FROM promotions WHERE restaurant_id = $1 ORDER BY created_at DESC',
      [restaurantId]
    );
    return result.rows.map(r => this.mapToEntity(r));
  }

  async findActiveByRestaurantId(restaurantId: string): Promise<Promotion[]> {
    const result = await this.pool.query(
      `SELECT * FROM promotions
       WHERE restaurant_id = $1 AND is_active = true
         AND starts_at <= NOW() AND ends_at >= NOW()
       ORDER BY created_at DESC`,
      [restaurantId]
    );
    return result.rows.map(r => this.mapToEntity(r));
  }

  async findAllActive(): Promise<Promotion[]> {
    const result = await this.pool.query(
      `SELECT * FROM promotions
       WHERE is_active = true AND starts_at <= NOW() AND ends_at >= NOW()
       ORDER BY created_at DESC`
    );
    return result.rows.map(r => this.mapToEntity(r));
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM promotions WHERE id = $1', [id]);
  }

  private mapToEntity(row: any): Promotion {
    return new Promotion({
      id: row.id,
      restaurantId: row.restaurant_id,
      title: row.title,
      description: row.description,
      type: row.type as PromotionType,
      discountValue: parseFloat(row.discount_value),
      isActive: row.is_active,
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
