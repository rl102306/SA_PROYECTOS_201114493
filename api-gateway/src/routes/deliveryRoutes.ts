import { Router, Request, Response } from 'express';
import { deliveryServiceClient } from '../grpc/clients/DeliveryServiceClient';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// GET /deliveries/pending — entregas pendientes (para repartidores que buscan trabajo)
router.get('/pending', authMiddleware, async (req: Request, res: Response) => {
  try {
    const response = await deliveryServiceClient.getPendingDeliveries();
    res.json({ success: response.success, deliveries: response.deliveries || [] });
  } catch (error: any) {
    console.error('Error en GET /deliveries/pending:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /deliveries/my — entregas asignadas al repartidor actual
router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const response = await deliveryServiceClient.getDeliveryPersonDeliveries(userId);
    res.json({ success: response.success, deliveries: response.deliveries || [] });
  } catch (error: any) {
    console.error('Error en GET /deliveries/my:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /deliveries/:id/accept — aceptar una entrega
router.post('/:id/accept', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const response = await deliveryServiceClient.acceptDelivery(
      req.params.id,
      user.userId,
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
    );
    if (response.success) {
      res.json({ success: true, message: response.message, delivery: response.delivery });
    } else {
      res.status(400).json({ success: false, message: response.message });
    }
  } catch (error: any) {
    console.error('Error en POST /deliveries/:id/accept:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /deliveries/:id/status — actualizar estado (con foto obligatoria si DELIVERED)
router.put('/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, cancellationReason, deliveryPhoto } = req.body;

    const response = await deliveryServiceClient.updateDeliveryStatus(
      req.params.id,
      status,
      cancellationReason,
      deliveryPhoto
    );

    if (response.success) {
      res.json({ success: true, message: response.message, delivery: response.delivery });
    } else {
      res.status(400).json({ success: false, message: response.message });
    }
  } catch (error: any) {
    console.error('Error en PUT /deliveries/:id/status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
