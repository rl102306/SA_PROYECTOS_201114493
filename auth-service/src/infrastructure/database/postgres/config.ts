import { Pool } from 'pg';

export const createDatabasePool = (): Pool => {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'auth_db',
    user: process.env.DB_USER || 'auth_user',
    password: process.env.DB_PASSWORD || 'auth_password',
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
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `;

  try {
    await pool.query(createTableQuery);
    console.log('✅ Tablas de base de datos inicializadas');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    throw error;
  }
};
