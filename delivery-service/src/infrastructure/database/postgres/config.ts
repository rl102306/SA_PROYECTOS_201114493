import { Pool } from 'pg';

export const createDatabasePool = (): Pool => {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5435'),
    database: process.env.DB_NAME || 'delivery_db',
    user: process.env.DB_USER || 'delivery_user',
    password: process.env.DB_PASSWORD || 'delivery_password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  return pool;
};

export const initializeDatabase = async (pool: Pool): Promise<void> => {
  const client = await pool.connect();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id UUID PRIMARY KEY,
        order_id UUID NOT NULL UNIQUE,
        delivery_person_id UUID,
        delivery_person_name VARCHAR(255),
        status VARCHAR(50) NOT NULL,
        pickup_address TEXT NOT NULL,
        delivery_address TEXT NOT NULL,
        estimated_time INTEGER,
        actual_delivery_time TIMESTAMP,
        cancellation_reason TEXT,
        delivery_photo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Agregar columna si ya existe la tabla (para actualizaciones en caliente)
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'deliveries' AND column_name = 'delivery_photo'
        ) THEN
          ALTER TABLE deliveries ADD COLUMN delivery_photo TEXT;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_deliveries_person_id ON deliveries(delivery_person_id);
    `);

    console.log('✅ Tabla deliveries creada o ya existe');
  } finally {
    client.release();
  }
};
