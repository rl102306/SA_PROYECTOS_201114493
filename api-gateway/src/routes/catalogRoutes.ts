import { Router, Request, Response } from 'express';
import { catalogServiceClient } from '../grpc/clients/CatalogServiceClient';

const router = Router();

// GET /catalog/restaurants - Listar todos los restaurantes activos
router.get('/restaurants', async (req: Request, res: Response) => {
  try {
    const response = await catalogServiceClient.listRestaurants(true);
    res.json({
      success: true,
      restaurants: response.restaurants.map((r: any) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        phone: r.phone,
        email: r.email,
        description: r.description
      }))
    });
  } catch (error: any) {
    console.error('Error en GET /catalog/restaurants:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al obtener restaurantes' });
  }
});

// GET /catalog/restaurants/:id/products - Obtener productos de un restaurante
router.get('/restaurants/:id/products', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await catalogServiceClient.getRestaurantCatalog(id);
    res.json({
      success: true,
      products: response.products.map((p: any) => ({
        id: p.id,
        restaurantId: p.restaurant_id,
        name: p.name,
        description: p.description,
        price: p.price,
        category: p.category,
        isAvailable: p.is_available,
        imageUrl: p.image_url
      }))
    });
  } catch (error: any) {
    console.error('Error en GET /catalog/restaurants/:id/products:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al obtener productos' });
  }
});

// GET /catalog/products/:id - Obtener producto por ID
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await catalogServiceClient.getProduct(id);
    if (!response.found) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    const p = response.product;
    res.json({
      success: true,
      product: {
        id: p.id,
        restaurantId: p.restaurant_id,
        name: p.name,
        description: p.description,
        price: p.price,
        category: p.category,
        isAvailable: p.is_available,
        imageUrl: p.image_url
      }
    });
  } catch (error: any) {
    console.error('Error en GET /catalog/products/:id:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al obtener producto' });
  }
});

export default router;
