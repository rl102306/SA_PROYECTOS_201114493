export interface IExchangeRateApiClient {
  fetchRate(fromCurrency: string, toCurrency: string): Promise<number>;
}
