import { Pool } from 'pg';

export const createDatabasePool = (): Pool => {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5436'),
    database: process.env.DB_NAME || 'payment_db',
    user: process.env.DB_USER || 'payment_user',
    password: process.env.DB_PASSWORD || 'payment_password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });
};

export const initializeDatabase = async (pool: Pool): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY,
        order_id UUID NOT NULL UNIQUE,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        amount_gtq DECIMAL(10,2) NOT NULL,
        amount_usd DECIMAL(10,2) NOT NULL,
        exchange_rate DECIMAL(10,6) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    `);
    console.log('✅ Tabla payments creada o ya existe');
  } finally {
    client.release();
  }
};
