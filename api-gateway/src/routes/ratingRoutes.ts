import { Router, Request, Response } from 'express';
import { catalogServiceClient } from '../grpc/clients/CatalogServiceClient';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// POST /ratings — crear calificación (requiere autenticación)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { orderId, restaurantId, deliveryPersonId, productId, type, stars, comment, recommended } = req.body;

    if (!orderId || !type) {
      return res.status(400).json({ success: false, message: 'orderId y type son requeridos' });
    }
    if ((type === 'RESTAURANT' || type === 'DELIVERY') && (stars === undefined || stars < 1 || stars > 5)) {
      return res.status(400).json({ success: false, message: 'stars debe ser entre 1 y 5 para calificaciones de restaurante/repartidor' });
    }

    const response = await catalogServiceClient.createRating({
      order_id: orderId,
      user_id: userId,
      restaurant_id: restaurantId || '',
      delivery_person_id: deliveryPersonId || '',
      product_id: productId || '',
      type,
      stars: stars || 0,
      comment: comment || '',
      recommended: recommended !== undefined ? recommended : false
    });

    res.status(response.success ? 201 : 400).json({
      success: response.success,
      message: response.message
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al registrar calificación' });
  }
});

// GET /ratings/restaurant/:id — promedio de un restaurante
router.get('/restaurant/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await catalogServiceClient.getRestaurantRating(id);
    res.json({
      success: true,
      restaurantId: response.restaurant_id,
      averageStars: response.average_stars,
      totalRatings: response.total_ratings
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener calificación' });
  }
});

// GET /ratings/delivery/:id — calificación promedio de un repartidor
router.get('/delivery/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await catalogServiceClient.getDeliveryPersonRating(id);
    res.json({
      success: true,
      deliveryPersonId: response.delivery_person_id,
      averageStars: response.average_stars,
      totalRatings: response.total_ratings
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener calificación del repartidor' });
  }
});

// GET /ratings/product/:id — recomendaciones de un producto
router.get('/product/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await catalogServiceClient.getProductRating(id);
    res.json({
      success: true,
      productId: response.product_id,
      recommendedCount: response.recommended_count,
      notRecommendedCount: response.not_recommended_count,
      totalRatings: response.total_ratings,
      recommendationRate: response.recommendation_rate
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener calificación de producto' });
  }
});

export default router;
