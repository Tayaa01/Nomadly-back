import { Module } from '@nestjs/common';
import { ImageCurrencyController } from './image-currency.controller';
import { GeminiModule } from '../gemini/gemini.module';
import { CurrencyConverterModule } from '../currency-converter/currency-converter.module';
import { TaxRefundModule } from '../tax-refund/tax-refund.module';

@Module({
  imports: [GeminiModule, CurrencyConverterModule, TaxRefundModule],
  controllers: [ImageCurrencyController],
})
export class ImageCurrencyModule {}
