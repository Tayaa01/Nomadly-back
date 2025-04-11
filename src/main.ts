import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust proxy settings for ngrok
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Security Configuration
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
  }));

  // Updated rate limiting configuration
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      keyGenerator: (req) => {
        return req.ip; // IP address from the most-trusted source
      },
    })
  );

  // Global Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // Updated CORS Configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        // Allow REST tools and server-to-server requests
        callback(null, true);
        return;
      }
      
      // Check if the origin matches any allowed pattern
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        // Handle wildcard domains
        if (allowedOrigin.includes('*')) {
          const pattern = allowedOrigin.replace(/\./g, '\\.').replace(/\*/g, '.*');
          return new RegExp(`^${pattern}$`).test(origin);
        }
        return allowedOrigin === origin;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.log(`Blocked CORS for: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
  });

  // Update Swagger Documentation with security scheme
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
      'access-token', // This name here is important for reference
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management')
    .addTag('Currency', 'Currency conversion tools')
    .addTag('Translation', 'Translation services')
    .addTag('Deals', 'Tax-free shopping and deals')
    .addServer(process.env.API_URL || 'http://localhost:3000', 'Development server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      security: [{ "access-token": [] }],
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      syntaxHighlight: {
        active: true,
        theme: 'monokai'
      },
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Nomadly API Documentation',
  });

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port, 'localhost');
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
