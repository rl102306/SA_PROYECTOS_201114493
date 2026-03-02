import { GetExchangeRateUseCase } from '../../../application/usecases/GetExchangeRateUseCase';

export class FxServiceHandler {
  constructor(private readonly getExchangeRateUseCase: GetExchangeRateUseCase) {}

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
}
