import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CurrencyConverterService {
  private readonly apiKey: string;
  private readonly apiUrl: string = 'https://api.exchangerate-api.com/v4/latest';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async convertCurrency(from: string, to: string, amount: number) {
    try {
      // Validate currency codes
      if (!from || !to) {
        throw new HttpException('Invalid currency code', HttpStatus.BAD_REQUEST);
      }

      // Convert to uppercase
      from = from.toUpperCase();
      to = to.toUpperCase();

      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/${from}`),
      );

      const rate = response.data.rates[to];
      if (!rate) {
        throw new HttpException(`Invalid currency code: ${to}`, HttpStatus.BAD_REQUEST);
      }

      return {
        from,
        to,
        amount,
        result: amount * rate,
        rate,
        timestamp: response.data.time_last_updated,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch exchange rates',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAvailableCurrencies() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/USD`),
      );
      return Object.keys(response.data.rates);
    } catch (error) {
      throw new HttpException(
        'Failed to fetch currencies',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
