import { Module } from '@nestjs/common';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './core/config/env.validation';

async function bootstrap() {
  // 🔒 Validate environment variables before startup
  try {
    const env = validateEnv();
    console.log('✅ Environment validation passed');
    console.log(`   - NODE_ENV: ${env.NODE_ENV}`);
    console.log(`   - PORT: ${env.PORT}`);
    console.log(`   - DATABASE: ${env.DATABASE_URL ? '✓' : '✗'}`);
    console.log(`   - JWT_SECRET: ${env.JWT_SECRET ? '✓ (set)' : '✗'}`);
    console.log(
      `   - 2FA_KEY: ${env.TWO_FACTOR_ENCRYPTION_KEY ? '✓ (set)' : '✗'}`,
    );
    console.log(`   - REDIS: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  // 🔒 Security Headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Additional security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()',
    );
    next();
  });

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  await app.listen(process.env.PORT || 3001);
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
}

bootstrap();
