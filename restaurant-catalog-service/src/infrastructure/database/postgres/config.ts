import { Pool } from 'pg';

export const createDatabasePool = (): Pool => {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'catalog_db',
    user: process.env.DB_USER || 'catalog_user',
    password: process.env.DB_PASSWORD || 'catalog_password',
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
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY,
      restaurant_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      category VARCHAR(100),
      is_available BOOLEAN DEFAULT true,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON products(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_is_available ON products(is_available);
  `;

  try {
    await pool.query(createTableQuery);
    console.log('✅ Tablas de base de datos inicializadas');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    throw error;
  }
};
