import { Pool } from 'pg';

export const createDatabasePool = (): Pool => {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'order_db',
    user: process.env.DB_USER || 'order_user',
    password: process.env.DB_PASSWORD || 'order_password',
  });

  pool.on('connect', () => {
    console.log('✅ Conectado a la base de datos PostgreSQL');
  });

  pool.on('error', (err) => {
    console.error('❌ Error en la conexión a PostgreSQL:', err);
  });

  return pool;
};

export const initializeDatabase = async (pool: Pool): Promise<void> => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      restaurant_id UUID NOT NULL,
      items JSONB NOT NULL,
      status VARCHAR(50) NOT NULL,
      total_amount DECIMAL(10, 2) NOT NULL,
      delivery_address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
  `;

  try {
    await pool.query(createTableQuery);
    console.log('✅ Tablas de base de datos inicializadas');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    throw error;
  }
};
