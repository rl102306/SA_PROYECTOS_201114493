import { Router, Request, Response } from 'express';
import { catalogServiceClient } from '../grpc/clients/CatalogServiceClient';
import { authMiddleware } from '../middleware/authMiddleware';
import { restaurantMiddleware } from '../middleware/restaurantMiddleware';

const router = Router();

// GET /catalog/restaurants — filtros opcionales: sortBy, tags, hasPromotion
router.get('/restaurants', async (req: Request, res: Response) => {
  try {
    const { sortBy, tags, hasPromotion } = req.query;
    const tagList = tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : [];
    const response = await catalogServiceClient.listRestaurants(true, {
      sortBy: sortBy as string | undefined,
      tags: tagList,
      hasPromotion: hasPromotion === 'true'
    });
    res.json({
      success: true,
      restaurants: response.restaurants.map((r: any) => ({
        id: r.id, name: r.name, address: r.address,
        phone: r.phone, email: r.email, description: r.description,
        tags: r.tags || [],
        avgRating: r.avg_rating || 0,
        totalRatings: r.total_ratings || 0
      }))
    });
  } catch (error: any) {
    console.error('Error en GET /catalog/restaurants:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al obtener restaurantes' });
  }
});

// GET /catalog/restaurants/:id/products
router.get('/restaurants/:id/products', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await catalogServiceClient.getRestaurantCatalog(id);
    res.json({
      success: true,
      products: response.products.map((p: any) => ({
        id: p.id, restaurantId: p.restaurant_id,
        name: p.name, description: p.description,
        price: p.price, category: p.category,
        isAvailable: p.is_available, imageUrl: p.image_url
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener productos' });
  }
});

// GET /catalog/restaurants/:id/promotions — public
router.get('/restaurants/:id/promotions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await catalogServiceClient.listPromotions(id, true);
    res.json({ success: true, promotions: response.promotions || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener promociones' });
  }
});

// GET /catalog/products/:id
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await catalogServiceClient.getProduct(id);
    if (!response.found) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    const p = response.product;
    res.json({
      success: true,
      product: {
        id: p.id, restaurantId: p.restaurant_id,
        name: p.name, description: p.description,
        price: p.price, category: p.category,
        isAvailable: p.is_available, imageUrl: p.image_url
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener producto' });
  }
});

// POST /catalog/coupons/validate — public (client applies coupon at checkout)
router.post('/coupons/validate', async (req: Request, res: Response) => {
  try {
    const { code, orderAmount } = req.body;
    if (!code || orderAmount === undefined) {
      return res.status(400).json({ success: false, message: 'code y orderAmount son requeridos' });
    }
    const response = await catalogServiceClient.validateCoupon(code, parseFloat(orderAmount));
    res.json({
      success: true,
      valid: response.valid,
      message: response.message,
      discountAmount: response.discount_amount,
      coupon: response.coupon ? {
        id: response.coupon.id,
        code: response.coupon.code,
        type: response.coupon.type,
        discountValue: response.coupon.discount_value,
        minOrderAmount: response.coupon.min_order_amount
      } : null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al validar cupón' });
  }
});

// ===== GESTIÓN DE MENÚ (RESTAURANT) =====
router.post('/menu', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const { restaurantId, name, description, price, category, isAvailable } = req.body;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    const response = await catalogServiceClient.createProduct({
      restaurant_id: restaurantId, name,
      description: description || '', price: parseFloat(price),
      category: category || '', is_available: isAvailable !== false
    });
    res.status(response.success ? 201 : 400).json({
      success: response.success, message: response.message,
      product: response.product ? {
        id: response.product.id, restaurantId: response.product.restaurant_id,
        name: response.product.name, description: response.product.description,
        price: response.product.price, category: response.product.category,
        isAvailable: response.product.is_available
      } : null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al crear producto' });
  }
});

router.put('/menu/:id', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { restaurantId, name, description, price, category, isAvailable } = req.body;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    const response = await catalogServiceClient.updateProduct({
      id, restaurant_id: restaurantId, name, description,
      price: price !== undefined ? parseFloat(price) : undefined,
      category, is_available: isAvailable
    });
    res.status(response.success ? 200 : 400).json({
      success: response.success, message: response.message,
      product: response.product ? {
        id: response.product.id, restaurantId: response.product.restaurant_id,
        name: response.product.name, description: response.product.description,
        price: response.product.price, category: response.product.category,
        isAvailable: response.product.is_available
      } : null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al actualizar producto' });
  }
});

router.delete('/menu/:id', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const restaurantId = req.query.restaurantId as string || req.body.restaurantId;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    const response = await catalogServiceClient.deleteProduct(id, restaurantId);
    res.status(response.success ? 200 : 400).json({ success: response.success, message: response.message });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al eliminar producto' });
  }
});

// ===== PROMOTIONS (RESTAURANT) =====
router.post('/promotions', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const { restaurantId, title, description, type, discountValue, startsAt, endsAt } = req.body;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    const response = await catalogServiceClient.createPromotion({
      restaurant_id: restaurantId, title,
      description: description || '',
      type: type || 'PERCENTAGE',
      discount_value: parseFloat(discountValue),
      starts_at: startsAt,
      ends_at: endsAt
    });
    res.status(response.success ? 201 : 400).json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al crear promoción' });
  }
});

router.get('/promotions', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const restaurantId = req.query.restaurantId as string;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    const response = await catalogServiceClient.listPromotions(restaurantId, false);
    res.json({ success: true, promotions: response.promotions || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener promociones' });
  }
});

router.delete('/promotions/:id', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const restaurantId = req.query.restaurantId as string || req.body.restaurantId;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    const response = await catalogServiceClient.deletePromotion(id, restaurantId);
    res.status(response.success ? 200 : 400).json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al eliminar promoción' });
  }
});

// ===== COUPONS (RESTAURANT) =====
router.post('/coupons', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const { restaurantId, code, description, type, discountValue, minOrderAmount, maxUses, expiresAt } = req.body;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    const response = await catalogServiceClient.createCoupon({
      restaurant_id: restaurantId, code,
      description: description || '',
      type: type || 'PERCENTAGE',
      discount_value: parseFloat(discountValue),
      min_order_amount: parseFloat(minOrderAmount || 0),
      max_uses: maxUses ? parseInt(maxUses) : 0,
      expires_at: expiresAt
    });
    res.status(response.success ? 201 : 400).json(response);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al crear cupón' });
  }
});

router.get('/coupons', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const restaurantId = req.query.restaurantId as string;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    const response = await catalogServiceClient.listCoupons(restaurantId);
    res.json({ success: true, coupons: response.coupons || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener cupones' });
  }
});

// ===== NOTIFICATIONS (RESTAURANT inbox via RabbitMQ) =====
router.get('/notifications', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const restaurantId = req.query.restaurantId as string;
    const unreadOnly = req.query.unreadOnly === 'true';
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    const response = await catalogServiceClient.getRestaurantNotifications(restaurantId, unreadOnly);
    res.json({
      success: true,
      notifications: (response.notifications || []).map((n: any) => ({
        id: n.id,
        orderId: n.order_id,
        userId: n.user_id,
        totalAmount: n.total_amount,
        deliveryAddress: n.delivery_address,
        items: (() => { try { return JSON.parse(n.items_json); } catch { return []; } })(),
        isRead: n.is_read,
        createdAt: n.created_at
      })),
      unreadCount: response.unread_count || 0
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener notificaciones' });
  }
});

router.patch('/notifications/read', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const { restaurantId, notificationId } = req.body;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    await catalogServiceClient.markNotificationsRead(restaurantId, notificationId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al marcar notificaciones' });
  }
});

export default router;
