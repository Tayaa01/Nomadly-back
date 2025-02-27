import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS configuration
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:4200'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    maxAge: 3600,
  });

  // Enhanced Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Nomadly API')
    .setDescription('Digital nomad tools for currency conversion, translation, and tax-free shopping')
    .setVersion('1.0')
    .addTag('Bill Analysis', 'Basic bill analysis and currency conversion')
    .addTag('Tax Free Shopping', 'Tax refund eligibility and processing for tourists')
    .addTag('Translation', 'Text and document translation services')
    .addServer('http://localhost:3000', 'Local development')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (
      controllerKey: string,
      methodKey: string
    ) => methodKey,
    deepScanRoutes: true,
  });
  
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
    },
  });

  await app.listen(3000);
}
bootstrap();
