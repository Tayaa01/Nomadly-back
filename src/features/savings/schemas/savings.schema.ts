import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Savings {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ default: 0 })
  totalSavings: number;

  @Prop({ default: 'USD' }) 
  currency: string;

  @Prop({ default: 0 })
  potentialRefunds: number;

  @Prop({ default: 0 })
  potentialRefundCount: number;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  savingsByCountry: Record<string, number>;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  savingsByCategory: Record<string, number>;
  
  @Prop({ type: Date, default: Date.now })
  lastUpdated: Date;
}

export type SavingsDocument = Savings & Document;
export const SavingsSchema = SchemaFactory.createForClass(Savings);
