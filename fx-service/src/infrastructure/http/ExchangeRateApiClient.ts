import axios from 'axios';
import { IExchangeRateApiClient } from '../../domain/interfaces/IExchangeRateApiClient';

export class ExchangeRateApiClient implements IExchangeRateApiClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.EXCHANGE_RATE_API_URL || 'https://open.er-api.com/v6/latest';
  }

  async fetchRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const url = `${this.baseUrl}/${fromCurrency}`;
    const response = await axios.get(url, { timeout: 5000 });

    if (response.data?.result !== 'success' && !response.data?.rates) {
      throw new Error(`Respuesta inválida de la API de tipo de cambio`);
    }

    const rate = response.data.rates?.[toCurrency];
    if (rate === undefined) {
      throw new Error(`Moneda ${toCurrency} no encontrada en la respuesta`);
    }

    return parseFloat(rate);
  }
}
