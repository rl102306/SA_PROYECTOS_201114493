import { Pool } from 'pg';
import { ICouponRepository } from '../../../domain/interfaces/ICouponRepository';
import { Coupon, DiscountType } from '../../../domain/entities/Coupon';

export class PostgresCouponRepository implements ICouponRepository {
  constructor(private readonly pool: Pool) {}

  async save(coupon: Coupon): Promise<Coupon> {
    const query = `
      INSERT INTO coupons (id, restaurant_id, code, description, type, discount_value, min_order_amount, max_uses, uses_count, is_approved, is_active, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        description = EXCLUDED.description,
        type = EXCLUDED.type,
        discount_value = EXCLUDED.discount_value,
        min_order_amount = EXCLUDED.min_order_amount,
        max_uses = EXCLUDED.max_uses,
        uses_count = EXCLUDED.uses_count,
        is_approved = EXCLUDED.is_approved,
        is_active = EXCLUDED.is_active,
        expires_at = EXCLUDED.expires_at,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;
    const values = [
      coupon.id, coupon.restaurantId, coupon.code,
      coupon.description || null, coupon.type, coupon.discountValue,
      coupon.minOrderAmount, coupon.maxUses || null, coupon.usesCount,
      coupon.isApproved, coupon.isActive, coupon.expiresAt,
      coupon.createdAt, coupon.updatedAt
    ];
    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Coupon | null> {
    const result = await this.pool.query('SELECT * FROM coupons WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async findByCode(code: string): Promise<Coupon | null> {
    const result = await this.pool.query(
      'SELECT * FROM coupons WHERE code = $1',
      [code.toUpperCase()]
    );
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows[0]);
  }

  async findByRestaurantId(restaurantId: string): Promise<Coupon[]> {
    const result = await this.pool.query(
      'SELECT * FROM coupons WHERE restaurant_id = $1 ORDER BY created_at DESC',
      [restaurantId]
    );
    return result.rows.map(r => this.mapToEntity(r));
  }

  async findPendingApproval(): Promise<Coupon[]> {
    const result = await this.pool.query(
      'SELECT * FROM coupons WHERE is_approved = false AND is_active = true ORDER BY created_at ASC'
    );
    return result.rows.map(r => this.mapToEntity(r));
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM coupons WHERE id = $1', [id]);
  }

  private mapToEntity(row: any): Coupon {
    return new Coupon({
      id: row.id,
      restaurantId: row.restaurant_id,
      code: row.code,
      description: row.description,
      type: row.type as DiscountType,
      discountValue: parseFloat(row.discount_value),
      minOrderAmount: parseFloat(row.min_order_amount),
      maxUses: row.max_uses,
      usesCount: parseInt(row.uses_count),
      isApproved: row.is_approved,
      isActive: row.is_active,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
