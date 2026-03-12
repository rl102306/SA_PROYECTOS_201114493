import { GetExchangeRateUseCase } from '../../../application/usecases/GetExchangeRateUseCase';
import { IExchangeRateApiClient } from '../../../domain/interfaces/IExchangeRateApiClient';

export class FxServiceHandler {
  constructor(
    private readonly getExchangeRateUseCase: GetExchangeRateUseCase,
    private readonly apiClient: IExchangeRateApiClient
  ) {}

  async GetExchangeRate(call: any, callback: any): Promise<void> {
    try {
      const { from_currency, to_currency } = call.request;
      const result = await this.getExchangeRateUseCase.execute(from_currency, to_currency);

      callback(null, {
        success: true,
        rate: result.rate,
        source: result.source,
        timestamp: new Date().toISOString(),
        message: `Tasa ${from_currency}→${to_currency}: ${result.rate} (fuente: ${result.source})`
      });
    } catch (error: any) {
      console.error('❌ Error en GetExchangeRate:', error);
      callback(null, {
        success: false,
        rate: 0,
        source: '',
        timestamp: new Date().toISOString(),
        message: error.message || 'Error al obtener tipo de cambio'
      });
    }
  }

  async GetAvailableCurrencies(call: any, callback: any): Promise<void> {
    try {
      const base = call.request.base || 'GTQ';
      const currencies = await this.apiClient.fetchCurrencies(base);
      callback(null, { success: true, currencies, message: `${currencies.length} divisas disponibles` });
    } catch (error: any) {
      console.error('❌ Error en GetAvailableCurrencies:', error);
      callback(null, { success: false, currencies: [], message: error.message || 'Error al obtener divisas' });
    }
  }
}
