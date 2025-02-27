import { Module } from '@nestjs/common';
import { SerperService } from './services/serper.service';
import { GeminiService } from './services/gemini.service';
import { DealsController } from './controllers/deals.controller';

@Module({
  imports: [],
  controllers: [DealsController],
  providers: [
    SerperService,
    GeminiService
  ],
  exports: [SerperService, GeminiService]
})
export class DealsModule {} 