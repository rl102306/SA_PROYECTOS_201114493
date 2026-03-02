import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import orderRoutes from './routes/orderRoutes';
import catalogRoutes from './routes/catalogRoutes';
import fxRoutes from './routes/fxRoutes';
import paymentRoutes from './routes/paymentRoutes';
import adminRoutes from './routes/adminRoutes';
import deliveryRoutes from './routes/deliveryRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware global
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de registro de peticiones
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Verificación de estado del servicio
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'API Gateway',
    timestamp: new Date().toISOString()
  });
});

// Rutas de la API
app.use('/auth', authRoutes);
app.use('/orders', orderRoutes);
app.use('/catalog', catalogRoutes);
app.use('/fx', fxRoutes);
app.use('/payments', paymentRoutes);
app.use('/admin', adminRoutes);
app.use('/deliveries', deliveryRoutes);

// Manejador de rutas no encontradas (404)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Manejador de errores globales
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error del servidor:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 API Gateway escuchando en puerto ${PORT}`);
  console.log(`📡 CORS habilitado para: ${process.env.CORS_ORIGIN || 'http://localhost:4200'}`);
  console.log(`🔗 Auth Service: ${process.env.AUTH_SERVICE_URL || 'localhost:50052'}`);
  console.log(`🔗 Order Service: ${process.env.ORDER_SERVICE_URL || 'localhost:50053'}`);
  console.log(`🔗 Catalog Service: ${process.env.CATALOG_SERVICE_URL || 'localhost:50051'}`);
  console.log(`🔗 Delivery Service: ${process.env.DELIVERY_SERVICE_URL || 'localhost:50054'}`);
  console.log(`🔗 FX Service: ${process.env.FX_SERVICE_URL || 'localhost:50056'}`);
  console.log(`🔗 Payment Service: ${process.env.PAYMENT_SERVICE_URL || 'localhost:50057'}`);
});
