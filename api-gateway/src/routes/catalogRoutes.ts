import { Router, Request, Response } from 'express';
import { catalogServiceClient } from '../grpc/clients/CatalogServiceClient';
import { authMiddleware } from '../middleware/authMiddleware';
import { restaurantMiddleware } from '../middleware/restaurantMiddleware';

const router = Router();

// GET /catalog/restaurants - Listar todos los restaurantes activos (público)
router.get('/restaurants', async (req: Request, res: Response) => {
  try {
    const response = await catalogServiceClient.listRestaurants(true);
    res.json({
      success: true,
      restaurants: response.restaurants.map((r: any) => ({
        id: r.id, name: r.name, address: r.address,
        phone: r.phone, email: r.email, description: r.description
      }))
    });
  } catch (error: any) {
    console.error('Error en GET /catalog/restaurants:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al obtener restaurantes' });
  }
});

// GET /catalog/restaurants/:id/products - Productos de un restaurante (público)
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
    console.error('Error en GET /catalog/restaurants/:id/products:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al obtener productos' });
  }
});

// GET /catalog/products/:id - Producto por ID (público)
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

// ===== GESTIÓN DE MENÚ (requiere JWT + rol RESTAURANT) =====

// POST /catalog/menu - Crear producto
router.post('/menu', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const { restaurantId, name, description, price, category, isAvailable } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    }

    const response = await catalogServiceClient.createProduct({
      restaurant_id: restaurantId,
      name,
      description: description || '',
      price: parseFloat(price),
      category: category || '',
      is_available: isAvailable !== false
    });

    res.status(response.success ? 201 : 400).json({
      success: response.success,
      message: response.message,
      product: response.product ? {
        id: response.product.id,
        restaurantId: response.product.restaurant_id,
        name: response.product.name,
        description: response.product.description,
        price: response.product.price,
        category: response.product.category,
        isAvailable: response.product.is_available
      } : null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al crear producto' });
  }
});

// PUT /catalog/menu/:id - Actualizar producto
router.put('/menu/:id', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { restaurantId, name, description, price, category, isAvailable } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    }

    const response = await catalogServiceClient.updateProduct({
      id,
      restaurant_id: restaurantId,
      name,
      description,
      price: price !== undefined ? parseFloat(price) : undefined,
      category,
      is_available: isAvailable
    });

    res.status(response.success ? 200 : 400).json({
      success: response.success,
      message: response.message,
      product: response.product ? {
        id: response.product.id,
        restaurantId: response.product.restaurant_id,
        name: response.product.name,
        description: response.product.description,
        price: response.product.price,
        category: response.product.category,
        isAvailable: response.product.is_available
      } : null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al actualizar producto' });
  }
});

// DELETE /catalog/menu/:id - Eliminar producto
router.delete('/menu/:id', authMiddleware, restaurantMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const restaurantId = req.query.restaurantId as string || req.body.restaurantId;
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'restaurantId es requerido' });
    }
    const response = await catalogServiceClient.deleteProduct(id, restaurantId);
    res.status(response.success ? 200 : 400).json({ success: response.success, message: response.message });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al eliminar producto' });
  }
});

export default router;
