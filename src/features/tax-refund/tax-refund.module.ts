import { Module } from '@nestjs/common';
import { TaxRefundController } from './tax-refund.controller';
import { TaxRefundService } from './tax-refund.service';
import { GeminiModule } from '../gemini/gemini.module';
import { CurrencyConverterModule } from '../currency-converter/currency-converter.module';

@Module({
  imports: [GeminiModule, CurrencyConverterModule],
  controllers: [TaxRefundController],
  providers: [TaxRefundService],
  exports: [TaxRefundService],
})
export class TaxRefundModule {}