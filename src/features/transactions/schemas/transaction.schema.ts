import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  originalAmount: number;

  @Prop({ required: true })
  originalCurrency: string;

  @Prop({ required: true, default: 0 })
  convertedAmount: number;

  @Prop({ required: true, default: 'USD' })
  convertedCurrency: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: 0 })
  taxRefundAmount: number;

  @Prop()
  taxRefundDescription: string;

  @Prop()
  country: string;

  @Prop({ type: Date, default: Date.now })
  scanDate: Date;

  @Prop({ type: Boolean, default: false })
  hasTaxRefund: boolean;

  @Prop({ type: Date }) // Add createdAt explicitly
  createdAt?: Date;
}

export type TransactionDocument = Transaction & Document;
export const TransactionSchema = SchemaFactory.createForClass(Transaction)
