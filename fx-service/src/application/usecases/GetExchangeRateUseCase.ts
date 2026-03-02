import { IExchangeRateCache } from '../../domain/interfaces/IExchangeRateCache';
import { IExchangeRateApiClient } from '../../domain/interfaces/IExchangeRateApiClient';

export interface ExchangeRateResult {
  rate: number;
  source: 'API' | 'CACHE' | 'CACHE_FALLBACK';
}

export class GetExchangeRateUseCase {
  constructor(
    private readonly cache: IExchangeRateCache,
    private readonly apiClient: IExchangeRateApiClient
  ) {}

  async execute(fromCurrency: string, toCurrency: string): Promise<ExchangeRateResult> {
    if (!fromCurrency || !toCurrency) {
      throw new Error('Se requieren las monedas de origen y destino');
    }

    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    const cacheKey = `fx:${from}:${to}`;

    // 1. Buscar en caché (con TTL vigente)
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      console.log(`✅ Tasa ${from}→${to} obtenida de caché: ${cached}`);
      return { rate: cached, source: 'CACHE' };
    }

    // 2. Consultar API externa
    try {
      const rate = await this.apiClient.fetchRate(from, to);
      await this.cache.set(cacheKey, rate, 86400); // TTL 24h
      console.log(`🌐 Tasa ${from}→${to} obtenida de API: ${rate}`);
      return { rate, source: 'API' };
    } catch (apiError) {
      console.error(`⚠️ API falló para ${from}→${to}:`, apiError);

      // 3. Fallback: buscar en caché aunque haya expirado
      const stale = await this.cache.getStale(cacheKey);
      if (stale !== null) {
        console.log(`🔄 Usando tasa OBSOLETA de caché como fallback: ${stale}`);
        return { rate: stale, source: 'CACHE_FALLBACK' };
      }

      throw new Error(
        `Tipo de cambio no disponible: la API falló y no hay valor en caché para ${from}→${to}`
      );
    }
  }
}
