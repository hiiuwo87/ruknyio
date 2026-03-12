import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { SanitizePipe } from './core/common/pipes/sanitize.pipe';
import { BigIntInterceptor } from './core/common/interceptors/bigint.interceptor';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import compression from 'compression';
import { randomUUID } from 'crypto';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 🔒 Request ID Middleware - Adds unique ID to each request for tracing
  app.use((req, res, next) => {
    req['requestId'] = req.headers['x-request-id'] || randomUUID();
    res.setHeader('X-Request-ID', req['requestId']);
    next();
  });

  // ⚡ Performance: Enable response compression (60-80% size reduction)
  // Compresses all responses > 1KB using gzip/deflate
  app.use(
    compression({
      threshold: 1024, // Only compress responses > 1KB
      level: 6, // Compression level (0-9, 6 is balanced for speed/size)
      filter: (req, res) => {
        // Don't compress if client doesn't accept encoding
        if (req.headers['x-no-compression']) {
          return false;
        }
        // Use compression filter function
        return compression.filter(req, res);
      },
    }),
  );

  // Increase body size limit for file uploads (with type-specific limits)
  // Images: 10MB, Documents: 20MB, Other: 5MB (enforced in upload controller)
  app.use(bodyParser.json({ limit: '25mb' }));
  app.use(bodyParser.urlencoded({ limit: '25mb', extended: true }));

  // Security: Cookie Parser
  app.use(cookieParser());

  // ⚡ Performance: Skip favicon/favicon.ico requests (don't log 404 errors)
  app.use((req, res, next) => {
    if (req.path === '/favicon.ico' || req.path === '/favicon.png' || req.path === '/manifest.json') {
      return res.status(204).send();
    }
    next();
  });

  // Security: CSRF Protection
  // ✅ Using SameSite=Lax cookies for CSRF protection instead of tokens
  // This is the recommended approach for SPA + API architecture
  // SameSite=Lax prevents cookies from being sent on cross-origin POST requests
  // Combined with CORS restrictions, this provides adequate CSRF protection

  // Security: Validate JWT_SECRET
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error(
      '❌ CRITICAL SECURITY ERROR: JWT_SECRET must be at least 32 characters long!',
    );
  }

  if (
    process.env.JWT_SECRET ===
    'your-super-secret-jwt-key-change-this-in-production'
  ) {
    throw new Error(
      '❌ CRITICAL SECURITY ERROR: Please change JWT_SECRET from default value!',
    );
  }

  // Security: Helmet - HTTP Security Headers
  app.use(
    helmet({
      // 🔒 HSTS - Force HTTPS for 1 year
      strictTransportSecurity: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
                styleSrc: ["'self'", 'https:'], // no inline styles in production
                scriptSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                upgradeInsecureRequests: [],
              },
            }
          : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin images for uploads
      crossOriginEmbedderPolicy: false,
      // 🔒 Additional security headers
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      dnsPrefetchControl: { allow: false },
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    }),
  );

  // Serve static files (uploaded images) with proper headers
  // Available at /uploads/ (direct) and /api/v1/uploads/ (via API prefix)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('Access-Control-Allow-Origin', '*'); // Allow from any origin for images
      res.set('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('X-Frame-Options', 'DENY');
      // Add ETag for better caching
      res.set('ETag', `"${Date.now()}"`);
    },
  });

  // ⚡ API Versioning - Using URI versioning (/api/v1, /api/v2, etc.)
  // Global prefix is just 'api', versioning adds /v1, /v2, etc.
  app.setGlobalPrefix('api');

  // Enable NestJS URI versioning for proper version support
  // v1 endpoints: /api/v1/events
  // v2 endpoints: /api/v2/events (use @Controller({ version: '2' }))
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // CORS - Allow access from network devices
  const allowedOrigins = [
    // Development
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // Production domains
    'https://rukny.io',
    'https://www.rukny.io',
    'https://app.rukny.io',
    'https://accounts.rukny.io',
    'https://rukny.store',
    'https://www.rukny.store',
    // Environment variable override
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_ALT,
    process.env.APP_FRONTEND_URL,
    process.env.AUTH_FRONTEND_URL,
  ].filter(Boolean); // Remove undefined values

  // In development, allow all local network IPs
  const isDevelopment = process.env.NODE_ENV !== 'production';

  app.enableCors({
    origin: isDevelopment
      ? (origin, callback) => {
          // Allow requests with no origin (mobile apps, Postman, etc.)
          if (!origin) return callback(null, true);

          // Allow localhost, local network IPs, and localtunnel URLs
          if (
            origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            origin.includes('.loca.lt') || // localtunnel URLs
            /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin) ||
            /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/.test(origin) ||
            allowedOrigins.includes(origin)
          ) {
            return callback(null, true);
          }

          callback(new Error('Not allowed by CORS'));
        }
      : allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Cache-Control',
    ],
  });

  // Validation & Sanitization
  app.useGlobalPipes(
    // XSS Sanitization - cleans all string inputs
    new SanitizePipe(),
    // Validation - validates and transforms DTOs
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global interceptor to convert BigInt values to JSON-serializable types
  app.useGlobalInterceptors(new BigIntInterceptor());

  // Swagger Documentation (disabled by default in production)
  const enableSwagger =
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SWAGGER === 'true';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Rukny.io API')
      .setDescription(
        'API Documentation for Rukny.io Platform - Social Profiles, Stores, and Events Management',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag(
        'Auth',
        'Authentication endpoints - Register, Login, Password Reset',
      )
      .addTag(
        'Profiles',
        'User profile management - Create, Update, View profiles',
      )
      .addTag(
        'Social Links',
        'Social media links - Twitter, Instagram, LinkedIn, etc.',
      )
      .addTag(
        'Short URLs',
        'URL shortener service - Create and track short links',
      )
      .addTag('Stores', 'E-commerce stores - Manage online stores')
      .addTag('Products', 'Product management - Add, Edit, Delete products')
      .addTag('Events', 'Event management - Create and manage events')
      .addTag('Payments', 'Payment processing - Stripe integration')
      .addTag('Subscriptions', 'Subscription plans - Basic, Premium, Pro')
      .addTag(
        'Analytics',
        'Analytics and tracking - User statistics and insights',
      )
      .addTag('Upload', 'File upload - Images and media')
      .addTag('Search', 'Global search - Search across all resources')
      .addTag('Health', 'Health checks - API status monitoring')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'Rukny.io API Documentation',
      customfavIcon: 'https://rukny.io/favicon.ico',
      customCss: '.swagger-ui .topbar { display: none }',
    });
  }

  const port = process.env.PORT || 3001;
  const host = process.env.HOST || '0.0.0.0'; // Listen on all interfaces
  await app.listen(port, host);

  console.log(`\n🚀 Server is running on:`);
  console.log(`   - Local:    http://localhost:${port}`);
  console.log(`   - Network:  http://0.0.0.0:${port}`);
  console.log(`\n📚 Swagger documentation: http://localhost:${port}/api/docs`);
  console.log(`🔗 API endpoint: http://localhost:${port}/api\n`);
}
bootstrap().catch((err) => {
  console.error('❌ Failed to start application:', err);
  process.exit(1);
});
