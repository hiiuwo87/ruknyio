import { z } from 'zod';

/**
 * 🔒 Environment Variables Validation Schema
 *
 * Validates all critical environment variables at startup
 * Prevents runtime errors due to missing or invalid configuration
 */

export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // JWT & Authentication
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security'),

  TWO_FACTOR_ENCRYPTION_KEY: z
    .string()
    .min(32, 'TWO_FACTOR_ENCRYPTION_KEY must be at least 32 characters'),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0'),

  // Frontend
  FRONTEND_URL: z
    .string()
    .url('FRONTEND_URL must be a valid URL')
    .default('http://localhost:3000'),

  // Cookies
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),

  // Security
  INTERNAL_API_SECRET: z
    .string()
    .min(32, 'INTERNAL_API_SECRET must be at least 32 characters')
    .optional(),

  // Account Lockout
  LOCKOUT_MAX_ATTEMPTS: z
    .string()
    .default('5')
    .transform((val) => parseInt(val, 10)),
  LOCKOUT_DURATION_MINUTES: z
    .string()
    .default('15')
    .transform((val) => parseInt(val, 10)),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // App
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .default('3001')
    .transform((val) => parseInt(val, 10)),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 * Throws error if validation fails
 */
export function validateEnv(): EnvConfig {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(
        `❌ Environment validation failed:\n${errorMessage}\n\n` +
          `Please check your .env file and ensure all required variables are set.`,
      );
    }
    throw error;
  }
}
