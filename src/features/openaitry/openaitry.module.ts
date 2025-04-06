import { Module } from '@nestjs/common';
import { OpenaitryController } from './openaitry.controller';
import { OpenaitryService } from './openaitry.service';

@Module({
  controllers: [OpenaitryController],
  providers: [OpenaitryService],
})
export class OpenaitryModule {}