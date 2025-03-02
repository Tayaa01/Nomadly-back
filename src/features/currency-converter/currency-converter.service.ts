import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AxiosError } from 'axios';

@Injectable()
export class CurrencyConverterService {
  private readonly logger = new Logger(CurrencyConverterService.name);
  private readonly apiUrl = 'https://api.exchangerate-api.com/v4/latest/';
  
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async convertCurrency(from: string, to: string, amount: number) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}${from}`).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Error fetching exchange rates: ${error.message}`);
            throw new HttpException(
              'Error fetching exchange rates',
              HttpStatus.SERVICE_UNAVAILABLE
            );
          })
        )
      );

      const rates = response.data.rates;
      const rate = rates[to];

      if (!rate) {
        throw new HttpException(
          `Currency ${to} not supported`,
          HttpStatus.BAD_REQUEST
        );
      }

      const result = amount * rate;
      const formattedResult = Math.round(result * 100) / 100;

      return {
        from,
        to,
        amount,
        rate,
        result: formattedResult
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Conversion error: ${error.message}`);
      throw new HttpException(
        'Currency conversion failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getSupportedCurrencies() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}USD`).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Error fetching currencies: ${error.message}`);
            throw new HttpException(
              'Error fetching supported currencies',
              HttpStatus.SERVICE_UNAVAILABLE
            );
          })
        )
      );

      const currencies = Object.keys(response.data.rates).map(code => ({
        code,
        name: this.getCurrencyName(code)
      }));

      return currencies;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Get currencies error: ${error.message}`);
      throw new HttpException(
        'Failed to fetch supported currencies',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private getCurrencyName(code: string): string {
    const currencyNames = {
      USD: 'US Dollar',
      EUR: 'Euro',
      JPY: 'Japanese Yen',
      GBP: 'British Pound',
      AUD: 'Australian Dollar',
      CAD: 'Canadian Dollar',
      CHF: 'Swiss Franc',
      CNY: 'Chinese Yuan',
      HKD: 'Hong Kong Dollar',
      NZD: 'New Zealand Dollar'
      // Add more as needed
    };

    return currencyNames[code] || code;
  }
}
