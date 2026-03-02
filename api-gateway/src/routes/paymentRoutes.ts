import { Router, Request, Response } from 'express';
import { paymentServiceClient } from '../grpc/clients/PaymentServiceClient';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// POST /payments — procesar pago de un pedido
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { orderId, amount, currency, paymentMethod, cardHolder, cardLastFour, walletId } = req.body;
    const user = (req as any).user;

    const response = await paymentServiceClient.processPayment({
      order_id: orderId,
      amount,
      currency: currency || 'GTQ',
      payment_method: paymentMethod,
      card_holder: cardHolder || '',
      card_last_four: cardLastFour || '',
      wallet_id: walletId || '',
      user_email: user?.email || '',
      user_name: user?.email || '',
      user_id: user?.userId || ''
    });

    if (response.success) {
      res.json({
        success: true,
        message: response.message,
        payment: response.payment
      });
    } else {
      res.status(400).json({ success: false, message: response.message });
    }
  } catch (error: any) {
    console.error('Error en POST /payments:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al procesar pago' });
  }
});

// GET /payments/order/:orderId — consultar pago de un pedido
router.get('/order/:orderId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const response = await paymentServiceClient.getPaymentByOrder(req.params.orderId);
    if (response.success) {
      res.json({ success: true, payment: response.payment });
    } else {
      res.status(404).json({ success: false, message: response.message });
    }
  } catch (error: any) {
    console.error('Error en GET /payments/order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
