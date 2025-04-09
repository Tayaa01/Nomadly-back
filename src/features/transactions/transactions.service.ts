import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { CurrencyConverterService } from '../currency-converter/currency-converter.service';
import { UsersService } from '../../users/users.service'; // Import UsersService

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
    private readonly currencyConverterService: CurrencyConverterService, // Inject CurrencyConverterService
    private readonly usersService: UsersService // Inject UsersService
  ) {}

  async create(transactionData: Partial<Transaction>): Promise<Transaction> {
    const transaction = new this.transactionModel(transactionData);
    return transaction.save();
  }

  async createManualTransaction(userId: string, data: { amount: number; currency: string; date: string; description: string; convertedCurrency: string }): Promise<Transaction> {
    // Fetch the user's currency from the database
    const userCurrency = await this.usersService.getUserCurrency(userId);

    // Convert the amount to the user's currency
    const conversion = await this.currencyConverterService.convertCurrency(data.currency, userCurrency.currency, data.amount);

    const transactionData: Partial<Transaction> = {
      userId: new Types.ObjectId(userId),
      originalAmount: data.amount,
      originalCurrency: data.currency,
      convertedAmount: conversion.result, // Use the converted amount
      convertedCurrency: userCurrency.currency, // Use the user's currency
      createdAt: new Date(data.date), // Convert string date to Date object
      description: data.description,
    };

    const transaction = new this.transactionModel(transactionData);
    return transaction.save();
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid ID format'); // Added validation for userId
    }

    return this.transactionModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getUserTotals(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid ID format'); // Added validation for userId
    }

    const transactions = await this.transactionModel.find({ userId: new Types.ObjectId(userId) }).exec();
    if (!transactions.length) {
      throw new NotFoundException(`No transactions found for user with ID ${userId}`);
    }

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
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid ID format'); // Added validation for userId
    }

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

  async getTransactionsWithDetails(userId: string): Promise<any[]> {
    return this.transactionModel.aggregate([
      // Match transactions for the user
      { $match: { userId: new Types.ObjectId(userId) } },
      // Lookup user details (assuming a User collection exists)
      {
        $lookup: {
          from: 'users', // Name of the User collection
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      // Unwind the userDetails array
      { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },
      // Project the desired fields
      {
        $project: {
          originalAmount: 1,
          originalCurrency: 1,
          convertedAmount: 1,
          convertedCurrency: 1,
          description: 1,
          taxRefundAmount: 1,
          taxRefundDescription: 1,
          country: 1,
          scanDate: 1,
          hasTaxRefund: 1,
          createdAt: 1,
          updatedAt: 1,
          userDetails: {
            firstName: 1,
            lastName: 1,
            email: 1,
          },
        },
      },
    ]);
  }

  async getUserTransactionsWithDetails(userId: string): Promise<any[]> {
    return this.transactionModel.find({ userId: new Types.ObjectId(userId) })
      .select('createdAt description originalCurrency originalAmount convertedAmount convertedCurrency') // Include converted fields
      .sort({ createdAt: -1 })
      .exec();
  }
}
