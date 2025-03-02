import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>
  ) {}

  async create(transactionData: Partial<Transaction>): Promise<Transaction> {
    const transaction = new this.transactionModel(transactionData);
    return transaction.save();
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    // Convert string ID to ObjectId like in savings service
    return this.transactionModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getUserTotals(userId: string) {
    // Convert string ID to ObjectId like in savings service
    const transactions = await this.transactionModel.find({ userId: new Types.ObjectId(userId) }).exec();
    
    // Calculate totals
    const totalOriginal = transactions.reduce((sum, t) => sum + t.originalAmount, 0);
    const totalConverted = transactions.reduce((sum, t) => sum + t.convertedAmount, 0);
    const totalTaxRefund = transactions.reduce((sum, t) => sum + (t.taxRefundAmount || 0), 0);
    const transactionCount = transactions.length;
    
    // Get unique currencies
    const currencies = [...new Set(transactions.map(t => t.originalCurrency))];
    const convertedCurrency = transactions.length > 0 ? transactions[0].convertedCurrency : null;
    
    return {
      totalOriginal,
      totalConverted,
      totalTaxRefund,
      transactionCount,
      currencies,
      convertedCurrency,
    };
  }

  async getTransactionsByDay(userId: string): Promise<any[]> {
    // Use MongoDB aggregation to group transactions by day
    return this.transactionModel.aggregate([
      // Match transactions for this user
      { $match: { userId: new Types.ObjectId(userId) } },
      // Add a date field with just the date portion (without time)
      { $addFields: {
        dateOnly: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
        }
      }},
      // Group by this date
      { $group: {
        _id: "$dateOnly",
        totalOriginal: { $sum: "$originalAmount" },
        totalConverted: { $sum: "$convertedAmount" },
        totalTaxRefund: { $sum: "$taxRefundAmount" },
        count: { $sum: 1 }
      }},
      // Sort by date (ascending)
      { $sort: { _id: 1 } },
      // Rename _id to date for clarity
      { $project: {
        date: "$_id",
        totalOriginal: 1,
        totalConverted: 1, 
        totalTaxRefund: 1,
        count: 1,
        _id: 0
      }}
    ]);
  }
}
