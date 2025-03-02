import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { Savings, SavingsDocument } from './schemas/savings.schema';
import { SavingsSummaryDto } from './dto/savings-summary.dto';

@Injectable()
export class SavingsService {
  constructor(
    @InjectModel(Savings.name) private savingsModel: Model<SavingsDocument>,
    @InjectConnection() private connection: Connection
  ) {}

  async findOrCreateForUser(userId: string): Promise<SavingsDocument> {
    let savings = await this.savingsModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
    
    if (!savings) {
      savings = new this.savingsModel({
        userId: new Types.ObjectId(userId),
        lastUpdated: new Date()
      });
      await savings.save();
    }
    
    return savings;
  }

  async getSavingsSummary(userId: string): Promise<SavingsSummaryDto> {
    const savings = await this.findOrCreateForUser(userId);
    
    // Update calculation to include potential refunds in total savings
    const totalSavings = (savings.totalSavings || 0) + (savings.potentialRefunds || 0);
    
    return {
      totalSavings, // Use the combined value
      currency: savings.currency || 'EUR',
      potentialRefunds: savings.potentialRefunds,
      potentialRefundCount: savings.potentialRefundCount,
      savingsByCountry: savings.savingsByCountry,
      savingsByCategory: savings.savingsByCategory,
      lastUpdated: savings.lastUpdated
    };
  }

  async addPotentialRefund(
    userId: string, 
    amount: number, 
    currency: string, 
    country: string,
    category?: string
  ): Promise<SavingsDocument> {
    const savings = await this.findOrCreateForUser(userId);
    
    // Add to total potential refunds amount
    savings.potentialRefunds += amount;
    savings.potentialRefundCount += 1;
    savings.lastUpdated = new Date();
    
    // Add to country-specific savings
    if (!savings.savingsByCountry[country]) {
      savings.savingsByCountry[country] = 0;
    }
    savings.savingsByCountry[country] += amount;
    
    // Add to category-specific savings if category provided
    if (category) {
      if (!savings.savingsByCategory[category]) {
        savings.savingsByCategory[category] = 0;
      }
      savings.savingsByCategory[category] += amount;
    }
    
    // Set currency if this is the first saving
    if (savings.totalSavings === 0) {
      savings.currency = currency;
    }
    
    await savings.save();
    return savings;
  }

  async resetSavings(userId: string): Promise<void> {
    const savings = await this.findOrCreateForUser(userId);
    
    savings.totalSavings = 0;
    savings.potentialRefunds = 0;
    savings.potentialRefundCount = 0;
    savings.savingsByCountry = {};
    savings.savingsByCategory = {};
    savings.lastUpdated = new Date();
    
    await savings.save();
  }

  async getUserSavingsStats(userId: string): Promise<any> {
    const savings = await this.findOrCreateForUser(userId);
    
    const totalSavings = (savings.totalSavings || 0) + (savings.potentialRefunds || 0);
    
    return {
      totalSavings,
      currency: savings.currency || 'EUR',
      potentialRefunds: savings.potentialRefunds,
      potentialRefundCount: savings.potentialRefundCount,
      savingsByCountry: savings.savingsByCountry,
      savingsByCategory: savings.savingsByCategory,
      lastUpdated: new Date()
    };
  }

  async getSavingsByDay(userId: string): Promise<any[]> {
    // We'll need to query transactions with tax refunds to get daily savings data
    const TransactionModel = this.connection.model('Transaction');
    
    return TransactionModel.aggregate([
      // Match transactions for this user that have tax refunds
      { $match: { 
        userId: new Types.ObjectId(userId),
        hasTaxRefund: true 
      }},
      // Add a date field with just the date portion (without time)
      { $addFields: {
        dateOnly: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
        }
      }},
      // Group by this date
      { $group: {
        _id: "$dateOnly",
        totalSavings: { $sum: "$taxRefundAmount" },
        count: { $sum: 1 }
      }},
      // Sort by date (ascending)
      { $sort: { _id: 1 } },
      // Rename _id to date for clarity
      { $project: {
        date: "$_id",
        totalSavings: 1,
        count: 1,
        _id: 0
      }}
    ]);
  }
}
