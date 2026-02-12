import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import orderRoutes from './routes/orderRoutes';
import catalogRoutes from './routes/catalogRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    service: 'API Gateway',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/orders', orderRoutes);
app.use('/catalog', catalogRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    success: false, 
    message: 'Ruta no encontrada' 
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Gateway escuchando en puerto ${PORT}`);
  console.log(`📡 CORS habilitado para: ${process.env.CORS_ORIGIN || 'http://localhost:4200'}`);
  console.log(`🔗 Auth Service: ${process.env.AUTH_SERVICE_URL || 'localhost:50052'}`);
  console.log(`🔗 Order Service: ${process.env.ORDER_SERVICE_URL || 'localhost:50053'}`);
  console.log(`🔗 Catalog Service: ${process.env.CATALOG_SERVICE_URL || 'localhost:50051'}`);
});
