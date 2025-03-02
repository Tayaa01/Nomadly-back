import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../../users/schemas/user.schema';

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User;

  @Prop({ required: true })
  originalAmount: number;

  @Prop({ required: true })
  originalCurrency: string;

  @Prop({ required: true })
  convertedAmount: number;

  @Prop({ required: true })
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
}

export type TransactionDocument = Transaction & Document;
export const TransactionSchema = SchemaFactory.createForClass(Transaction);
