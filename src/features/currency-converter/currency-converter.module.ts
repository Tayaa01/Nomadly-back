import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CurrencyConverterController } from './currency-converter.controller';
import { CurrencyConverterService } from './currency-converter.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule
  ],
  controllers: [CurrencyConverterController],
  providers: [CurrencyConverterService],
  exports: [CurrencyConverterService], // Add this line
})
export class CurrencyConverterModule {}
