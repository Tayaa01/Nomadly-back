import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CurrencyConverterModule } from './features/currency-converter/currency-converter.module';
import { GeminiModule } from './features/gemini/gemini.module';
import { ImageCurrencyModule } from './features/integrated/image-currency.module';
import { TranslationModule } from './features/translation/translation.module';

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
      }),
    }),
    CurrencyConverterModule,
    GeminiModule,
    ImageCurrencyModule,
    TranslationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
