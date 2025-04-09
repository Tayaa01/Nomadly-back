import { Module } from '@nestjs/common';
import { TaxRefundController } from './tax-refund.controller';
import { TaxRefundService } from './tax-refund.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { GeminiModule } from '../gemini/gemini.module';
import { CurrencyConverterModule } from '../currency-converter/currency-converter.module';
import { SavingsModule } from '../savings/savings.module';

@Module({
  imports: [
    TransactionsModule, // Ensure this is imported
    GeminiModule,
    CurrencyConverterModule,
    SavingsModule
  ],
  controllers: [TaxRefundController],
  providers: [TaxRefundService],
  exports: [TaxRefundService],
})
export class TaxRefundModule {}