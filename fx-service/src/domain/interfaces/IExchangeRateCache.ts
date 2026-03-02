export interface IExchangeRateCache {
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttlSeconds: number): Promise<void>;
  getStale(key: string): Promise<number | null>;
}
