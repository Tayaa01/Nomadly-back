import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CurrencyConverterModule } from './features/currency-converter/currency-converter.module';
import { GeminiModule } from './features/gemini/gemini.module';
import { ImageCurrencyModule } from './features/integrated/image-currency.module';
import { TranslationModule } from './features/translation/translation.module';
import { DealsModule } from './features/deals/deals.module';
import { AuthModule } from './features/auth/auth.module';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './features/transactions/transactions.module';
import { SavingsModule } from './features/savings/savings.module';
import { OpenaitryModule } from './features/openaitry/openaitry.module';
import { MailTestController } from './mail-test.controller';

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
        MAIL_HOST: Joi.string().required(),
        MAIL_PORT: Joi.number().required(),
        MAIL_SECURE: Joi.string().required(),
        MAIL_USER: Joi.string().required(),
        MAIL_PASSWORD: Joi.string().required(),
        MAIL_FROM: Joi.string().required(),
        CORS_ORIGINS: Joi.string().optional().default(''), // Add validation for CORS_ORIGINS
      }),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('MAIL_HOST'),
          port: configService.get<number>('MAIL_PORT'),
          secure: configService.get<string>('MAIL_SECURE') === 'true',
          auth: {
            user: configService.get<string>('MAIL_USER'),
            pass: configService.get<string>('MAIL_PASSWORD'),
          },
          tls: {
            rejectUnauthorized: false // To avoid self-signed certificate issues
          },
          debug: true, // Enable debugging - helps troubleshoot
          logger: true  // Log SMTP traffic
        },
        defaults: {
          from: configService.get<string>('MAIL_FROM'),
        },
        template: {
          dir: join(__dirname, process.env.NODE_ENV === 'production' ? 'mail-templates' : '../src/mail-templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
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
  controllers: [AppController, MailTestController],
  providers: [AppService],
})
export class AppModule { }
