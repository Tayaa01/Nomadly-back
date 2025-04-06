import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CurrencyConverterModule } from './features/currency-converter/currency-converter.module';
import { GeminiModule } from './features/gemini/gemini.module';
import { ImageCurrencyModule } from './features/integrated/image-currency.module';
import { TranslationModule } from './features/translation/translation.module';
import { DealsModule } from './features/deals/deals.module';
import { AuthModule } from './features/auth/auth.module';
import { UsersModule } from './users/users.module';  // Updated import path
import { TransactionsModule } from './features/transactions/transactions.module';
import { SavingsModule } from './features/savings/savings.module';
import { OpenaitryModule } from './features/openaitry/openaitry.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      cache: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string().default('development'),
        TAYAA_API_KEY: Joi.string().required(),
        MONGODB_URI: Joi.string().required(),
      }),
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    CurrencyConverterModule,
    GeminiModule,
    ImageCurrencyModule,
    TranslationModule,
    DealsModule,
    AuthModule,
    UsersModule,
    TransactionsModule,
    SavingsModule,
    OpenaitryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
