import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>
  ) {}

  async create(transactionData: Partial<Transaction>): Promise<Transaction> {
    const transaction = new this.transactionModel(transactionData);
    return transaction.save();
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return this.transactionModel.find({ userId }).sort({ scanDate: -1 }).exec();
  }

  async getUserTotals(userId: string) {
    const transactions = await this.transactionModel.find({ userId }).exec();
    
    return {
      totalConverted: transactions.reduce((sum, t) => sum + t.convertedAmount, 0),
      totalTaxRefund: transactions.reduce((sum, t) => sum + t.taxRefundAmount, 0),
      transactionCount: transactions.length
    };
  }
}
