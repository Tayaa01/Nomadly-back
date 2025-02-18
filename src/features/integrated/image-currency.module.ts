import { Module } from '@nestjs/common';
import { ImageCurrencyController } from './image-currency.controller';
import { GeminiModule } from '../gemini/gemini.module';
import { CurrencyConverterModule } from '../currency-converter/currency-converter.module';

@Module({
  imports: [GeminiModule, CurrencyConverterModule],
  controllers: [ImageCurrencyController],
})
export class ImageCurrencyModule {}
