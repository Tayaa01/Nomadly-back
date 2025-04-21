import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust proxy settings
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Security Middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
  }));

  // Rate Limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      keyGenerator: (req) => req.ip,
    })
  );

  // Global Validation Pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // Set prefix to '/api' as requested (changed from 'eventai/api')
  app.setGlobalPrefix('api');

  // Configure CORS as requested
  app.enableCors({
    origin: ['http://localhost:4200', 'http://espritmobile.com'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
  });

  // Swagger Setup
  const config = new DocumentBuilder()
    .setTitle('Nomadly API')
    .setDescription('Digital nomad tools and services API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT token',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management')
    .addTag('Currency', 'Currency conversion tools')
    .addTag('Translation', 'Translation services')
    .addTag('Deals', 'Tax-free shopping and deals')
    .addServer('http://localhost:3000', 'Local Development Server')
    .addServer('http://localhost:3005', 'Docker Development Server')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Configure Swagger with HTTP (not HTTPS) as requested
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      validatorUrl: null,
      persistAuthorization: true,
      security: [{ "access-token": [] }],
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Nomadly API Documentation',
  });

  const port = 3000;
  await app.listen(port, '0.0.0.0');
  
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`API is available at: http://localhost:${port}/api`);
  console.log(`Swagger is available at: http://localhost:${port}/api-docs`);
}

bootstrap().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
