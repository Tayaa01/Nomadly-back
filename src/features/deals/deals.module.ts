import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { DealsController } from './controllers/deals.controller';
import { SerperService } from './services/serper.service';
import { TravelSerperService } from './services/travel-serper.service';
import { GeminiService } from './services/gemini.service';
import { DealsAggregatorService } from './services/deals-aggregator.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
  ],
  controllers: [DealsController],
  providers: [
    SerperService,
    TravelSerperService,
    GeminiService,
    DealsAggregatorService,
  ],
  exports: [
    SerperService,
    GeminiService,
    DealsAggregatorService,
  ],
})
export class DealsModule {}