import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Plan {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  country: string;

  @Prop({ type: Number, required: true })
  days: number;

  @Prop({ type: String, required: true })
  startDate: string;

  @Prop({ type: Number })
  budget?: number;

  @Prop({ type: Number })
  estimatedBudget?: number;

  @Prop({ type: Boolean, default: false })
  isBudgetOptimized: boolean;

  @Prop({ type: Array, required: true })
  daysContent: { content: string }[];

  @Prop({ type: String })
  additionalInfo?: string;
}

export type PlanDocument = Plan & Document;
export const PlanSchema = SchemaFactory.createForClass(Plan);
