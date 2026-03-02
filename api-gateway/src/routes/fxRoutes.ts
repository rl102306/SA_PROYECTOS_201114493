import { Router, Request, Response } from 'express';
import { fxServiceClient } from '../grpc/clients/FxServiceClient';

const router = Router();

// GET /fx/rate?from=USD&to=GTQ
router.get('/rate', async (req: Request, res: Response) => {
  try {
    const from = (req.query.from as string) || 'USD';
    const to = (req.query.to as string) || 'GTQ';

    const response = await fxServiceClient.getExchangeRate(from, to);

    res.json({
      success: response.success,
      from,
      to,
      rate: response.rate,
      source: response.source,
      timestamp: response.timestamp,
      message: response.message
    });
  } catch (error: any) {
    console.error('Error en GET /fx/rate:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al obtener tipo de cambio' });
  }
});

export default router;
