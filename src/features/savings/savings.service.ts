import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Savings, SavingsDocument } from './schemas/savings.schema';
import { SavingsSummaryDto } from './dto/savings-summary.dto';

@Injectable()
export class SavingsService {
  constructor(
    @InjectModel(Savings.name) private savingsModel: Model<SavingsDocument>
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
    
    return {
      totalSavings: savings.totalSavings,
      currency: savings.currency,
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
}
