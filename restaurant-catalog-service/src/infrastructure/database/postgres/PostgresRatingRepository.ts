import { Pool } from 'pg';
import { IRatingRepository, RestaurantRatingSummary, ProductRatingSummary, DeliveryPersonRatingSummary } from '../../../domain/interfaces/IRatingRepository';
import { Rating, RatingType } from '../../../domain/entities/Rating';

export class PostgresRatingRepository implements IRatingRepository {
  constructor(private readonly pool: Pool) {}

  async save(rating: Rating): Promise<Rating> {
    const query = `
      INSERT INTO ratings (id, order_id, user_id, restaurant_id, delivery_person_id, product_id, type, stars, comment, recommended, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const values = [
      rating.id, rating.orderId, rating.userId,
      rating.restaurantId || null, rating.deliveryPersonId || null,
      rating.productId || null, rating.type,
      rating.stars || null, rating.comment || null,
      rating.recommended !== undefined ? rating.recommended : null,
      rating.createdAt
    ];
    const result = await this.pool.query(query, values);
    return this.mapToEntity(result.rows[0]);
  }

  async findByOrderId(orderId: string): Promise<Rating[]> {
    const result = await this.pool.query(
      'SELECT * FROM ratings WHERE order_id = $1 ORDER BY created_at DESC',
      [orderId]
    );
    return result.rows.map(r => this.mapToEntity(r));
  }

  async findByRestaurantId(restaurantId: string): Promise<Rating[]> {
    const result = await this.pool.query(
      `SELECT * FROM ratings WHERE restaurant_id = $1 AND type = 'RESTAURANT' ORDER BY created_at DESC`,
      [restaurantId]
    );
    return result.rows.map(r => this.mapToEntity(r));
  }

  async findByProductId(productId: string): Promise<Rating[]> {
    const result = await this.pool.query(
      `SELECT * FROM ratings WHERE product_id = $1 AND type = 'PRODUCT' ORDER BY created_at DESC`,
      [productId]
    );
    return result.rows.map(r => this.mapToEntity(r));
  }

  async getRestaurantSummary(restaurantId: string): Promise<RestaurantRatingSummary> {
    const result = await this.pool.query(
      `SELECT
        restaurant_id,
        COALESCE(AVG(stars), 0) as average_stars,
        COUNT(*) as total_ratings
       FROM ratings
       WHERE restaurant_id = $1 AND type = 'RESTAURANT' AND stars IS NOT NULL
       GROUP BY restaurant_id`,
      [restaurantId]
    );
    if (result.rows.length === 0) {
      return { restaurantId, averageStars: 0, totalRatings: 0 };
    }
    const row = result.rows[0];
    return {
      restaurantId: row.restaurant_id,
      averageStars: parseFloat(parseFloat(row.average_stars).toFixed(1)),
      totalRatings: parseInt(row.total_ratings)
    };
  }

  async getProductSummary(productId: string): Promise<ProductRatingSummary> {
    const result = await this.pool.query(
      `SELECT
        product_id,
        SUM(CASE WHEN recommended = true THEN 1 ELSE 0 END) as recommended_count,
        SUM(CASE WHEN recommended = false THEN 1 ELSE 0 END) as not_recommended_count,
        COUNT(*) as total_ratings
       FROM ratings
       WHERE product_id = $1 AND type = 'PRODUCT' AND recommended IS NOT NULL
       GROUP BY product_id`,
      [productId]
    );
    if (result.rows.length === 0) {
      return { productId, recommendedCount: 0, notRecommendedCount: 0, totalRatings: 0, recommendationRate: 0 };
    }
    const row = result.rows[0];
    const total = parseInt(row.total_ratings);
    const recommended = parseInt(row.recommended_count);
    return {
      productId: row.product_id,
      recommendedCount: recommended,
      notRecommendedCount: parseInt(row.not_recommended_count),
      totalRatings: total,
      recommendationRate: total > 0 ? parseFloat((recommended / total * 100).toFixed(1)) : 0
    };
  }

  async getDeliveryPersonSummary(deliveryPersonId: string): Promise<DeliveryPersonRatingSummary> {
    const result = await this.pool.query(
      `SELECT
        delivery_person_id,
        COALESCE(AVG(stars), 0) as average_stars,
        COUNT(*) as total_ratings
       FROM ratings
       WHERE delivery_person_id = $1 AND type = 'DELIVERY' AND stars IS NOT NULL
       GROUP BY delivery_person_id`,
      [deliveryPersonId]
    );
    if (result.rows.length === 0) {
      return { deliveryPersonId, averageStars: 0, totalRatings: 0 };
    }
    const row = result.rows[0];
    return {
      deliveryPersonId: row.delivery_person_id,
      averageStars: parseFloat(parseFloat(row.average_stars).toFixed(1)),
      totalRatings: parseInt(row.total_ratings)
    };
  }

  async getTopRatedRestaurants(limit: number): Promise<RestaurantRatingSummary[]> {
    const result = await this.pool.query(
      `SELECT
        restaurant_id,
        COALESCE(AVG(stars), 0) as average_stars,
        COUNT(*) as total_ratings
       FROM ratings
       WHERE type = 'RESTAURANT' AND stars IS NOT NULL
       GROUP BY restaurant_id
       HAVING COUNT(*) >= 1
       ORDER BY average_stars DESC, total_ratings DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => ({
      restaurantId: row.restaurant_id,
      averageStars: parseFloat(parseFloat(row.average_stars).toFixed(1)),
      totalRatings: parseInt(row.total_ratings)
    }));
  }

  private mapToEntity(row: any): Rating {
    return new Rating({
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      restaurantId: row.restaurant_id,
      deliveryPersonId: row.delivery_person_id,
      productId: row.product_id,
      type: row.type as RatingType,
      stars: row.stars,
      comment: row.comment,
      recommended: row.recommended,
      createdAt: new Date(row.created_at)
    });
  }
}
