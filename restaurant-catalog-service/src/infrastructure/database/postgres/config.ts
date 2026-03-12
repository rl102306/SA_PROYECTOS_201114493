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
    CREATE TABLE IF NOT EXISTS restaurants (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(255),
      phone VARCHAR(50),
      email VARCHAR(255),
      schedule VARCHAR(255),
      description TEXT,
      image_url TEXT,
      is_active BOOLEAN DEFAULT true,
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

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

    CREATE TABLE IF NOT EXISTS promotions (
      id UUID PRIMARY KEY,
      restaurant_id UUID NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL,
      discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      starts_at TIMESTAMP NOT NULL,
      ends_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id UUID PRIMARY KEY,
      restaurant_id UUID NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      type VARCHAR(50) NOT NULL,
      discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      min_order_amount DECIMAL(10,2) DEFAULT 0,
      max_uses INT DEFAULT NULL,
      uses_count INT DEFAULT 0,
      is_approved BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id UUID PRIMARY KEY,
      order_id UUID NOT NULL,
      user_id UUID NOT NULL,
      restaurant_id UUID,
      delivery_person_id UUID,
      product_id UUID,
      type VARCHAR(50) NOT NULL,
      stars INT,
      comment TEXT,
      recommended BOOLEAN,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS restaurant_order_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL,
      order_id UUID NOT NULL,
      user_id UUID NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      delivery_address TEXT,
      items JSONB NOT NULL DEFAULT '[]',
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON products(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_is_available ON products(is_available);
    CREATE INDEX IF NOT EXISTS idx_promotions_restaurant_id ON promotions(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_promotions_is_active ON promotions(is_active);
    CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
    CREATE INDEX IF NOT EXISTS idx_coupons_restaurant_id ON coupons(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_restaurant_id ON ratings(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_product_id ON ratings(product_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_restaurant_id ON restaurant_order_notifications(restaurant_id);
  `;

  try {
    await pool.query(createTableQuery);
    console.log('✅ Tablas de base de datos inicializadas');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    throw error;
  }
};
