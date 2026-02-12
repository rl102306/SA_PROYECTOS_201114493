import { Router, Request, Response } from 'express';

const router = Router();

// GET /catalog/restaurants/:id - Obtener catálogo de un restaurante
router.get('/restaurants/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // TODO: Implementar llamada a Catalog Service
    res.json({
      success: true,
      message: 'Endpoint pendiente de implementación',
      restaurantId: id
    });
  } catch (error: any) {
    console.error('Error en GET /catalog/restaurants/:id:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener catálogo'
    });
  }
});

// GET /catalog/products/:id - Obtener producto por ID
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // TODO: Implementar llamada a Catalog Service
    res.json({
      success: true,
      message: 'Endpoint pendiente de implementación',
      productId: id
    });
  } catch (error: any) {
    console.error('Error en GET /catalog/products/:id:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener producto'
    });
  }
});

export default router;
