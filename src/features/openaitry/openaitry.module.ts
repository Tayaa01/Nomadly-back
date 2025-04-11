import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OpenaitryController } from './openaitry.controller';
import { OpenaitryService } from './openaitry.service';
import { Plan, PlanSchema } from './schemas/plan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Plan.name, schema: PlanSchema }])
  ],
  controllers: [OpenaitryController],
  providers: [OpenaitryService],
  exports: [OpenaitryService]
})
export class OpenaitryModule {}