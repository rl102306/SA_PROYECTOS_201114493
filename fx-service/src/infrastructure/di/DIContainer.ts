import { RedisExchangeRateCache } from '../cache/RedisExchangeRateCache';
import { ExchangeRateApiClient } from '../http/ExchangeRateApiClient';
import { GetExchangeRateUseCase } from '../../application/usecases/GetExchangeRateUseCase';
import { FxServiceHandler } from '../grpc/handlers/FxServiceHandler';

export class DIContainer {
  private static instance: DIContainer;
  private handler: FxServiceHandler;
  private cache: RedisExchangeRateCache;

  private constructor() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    this.cache = new RedisExchangeRateCache(redisHost, redisPort);
    const apiClient = new ExchangeRateApiClient();
    const useCase = new GetExchangeRateUseCase(this.cache, apiClient);
    this.handler = new FxServiceHandler(useCase, apiClient);
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  getFxServiceHandler(): FxServiceHandler {
    return this.handler;
  }

  getCache(): RedisExchangeRateCache {
    return this.cache;
  }
}
