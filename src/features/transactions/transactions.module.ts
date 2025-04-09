import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionsService } from './transactions.service';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { TransactionsController } from './transactions.controller';
import { AuthModule } from '../auth/auth.module';
import { CurrencyConverterModule } from '../currency-converter/currency-converter.module';
import { UsersModule } from '../../users/users.module'; // Import UsersModule

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema }
    ]),
    AuthModule, // Make sure this is imported
    CurrencyConverterModule, // Add the module here
    UsersModule, // Import UsersModule to make UsersService available
  ],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService]
})
export class TransactionsModule {}
