import Redis from 'ioredis';
import { IExchangeRateCache } from '../../domain/interfaces/IExchangeRateCache';

export class RedisExchangeRateCache implements IExchangeRateCache {
  private readonly redis: Redis;
  // Clave de respaldo permanente (sin TTL) para fallback
  private stalePrefix = 'fx:stale:';

  constructor(host: string, port: number) {
    this.redis = new Redis({ host, port, lazyConnect: true });
    this.redis.on('error', (err) => console.error('❌ Redis error:', err));
    this.redis.on('connect', () => console.log('✅ Redis conectado'));
  }

  async get(key: string): Promise<number | null> {
    const value = await this.redis.get(key);
    if (value === null) return null;
    return parseFloat(value);
  }

  async set(key: string, value: number, ttlSeconds: number): Promise<void> {
    // Guardar con TTL (para caché normal)
    await this.redis.setex(key, ttlSeconds, value.toString());
    // Guardar copia permanente para fallback (sin TTL)
    await this.redis.set(`${this.stalePrefix}${key}`, value.toString());
  }

  async getStale(key: string): Promise<number | null> {
    const value = await this.redis.get(`${this.stalePrefix}${key}`);
    if (value === null) return null;
    return parseFloat(value);
  }

  async quit(): Promise<void> {
    await this.redis.quit();
  }
}
