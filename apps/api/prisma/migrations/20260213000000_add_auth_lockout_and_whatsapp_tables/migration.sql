-- Add missing auth and WhatsApp tables required by the API.
-- These models exist in schema.prisma but were never applied via a Prisma migration.

-- Enums required by whatsapp_otps and whatsapp_notifications (create only if missing)
DO $$ BEGIN
  CREATE TYPE "AccountType" AS ENUM ('REGULAR', 'GUEST_CHECKOUT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OtpType" AS ENUM ('CHECKOUT', 'LOGIN', 'VERIFICATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsappNotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsappNotificationType" AS ENUM (
    'OTP',
    'ORDER_CONFIRMED',
    'ORDER_PROCESSING',
    'ORDER_SHIPPED',
    'ORDER_OUT_FOR_DELIVERY',
    'ORDER_DELIVERED',
    'ORDER_CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional: ensure users columns exist (in case whatsapp_checkout_system.sql was never run)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accountType" "AccountType" DEFAULT 'REGULAR';
CREATE UNIQUE INDEX IF NOT EXISTS "users_phoneNumber_key" ON "users"("phoneNumber");
CREATE INDEX IF NOT EXISTS "users_phoneNumber_idx" ON "users"("phoneNumber");

-- Table: account_lockouts (AccountLockout)
CREATE TABLE IF NOT EXISTS "account_lockouts" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "lockCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastAttempt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "account_lockouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "account_lockouts_email_key" ON "account_lockouts"("email");
CREATE INDEX IF NOT EXISTS "account_lockouts_lockedUntil_idx" ON "account_lockouts"("lockedUntil");

-- Table: login_attempts (LoginAttempt)
CREATE TABLE IF NOT EXISTS "login_attempts" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "ipAddress" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "login_attempts_email_idx" ON "login_attempts"("email");
CREATE INDEX IF NOT EXISTS "login_attempts_ipAddress_idx" ON "login_attempts"("ipAddress");
CREATE INDEX IF NOT EXISTS "login_attempts_createdAt_idx" ON "login_attempts"("createdAt");
CREATE INDEX IF NOT EXISTS "login_attempts_success_idx" ON "login_attempts"("success");

-- Table: ip_lockouts (IPLockout)
CREATE TABLE IF NOT EXISTS "ip_lockouts" (
  "id" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastAttempt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ip_lockouts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ip_lockouts_ipAddress_key" ON "ip_lockouts"("ipAddress");
CREATE INDEX IF NOT EXISTS "ip_lockouts_lockedUntil_idx" ON "ip_lockouts"("lockedUntil");

-- Table: whatsapp_otps (WhatsappOtp)
CREATE TABLE IF NOT EXISTS "whatsapp_otps" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "phoneNumber" TEXT,
  "email" TEXT,
  "codeHash" TEXT NOT NULL,
  "type" "OtpType" NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentVia" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',

  CONSTRAINT "whatsapp_otps_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_otps_userId_fkey') THEN
    ALTER TABLE "whatsapp_otps" ADD CONSTRAINT "whatsapp_otps_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "whatsapp_otps_phoneNumber_idx" ON "whatsapp_otps"("phoneNumber");
CREATE INDEX IF NOT EXISTS "whatsapp_otps_email_idx" ON "whatsapp_otps"("email");
CREATE INDEX IF NOT EXISTS "whatsapp_otps_expiresAt_idx" ON "whatsapp_otps"("expiresAt");
CREATE INDEX IF NOT EXISTS "whatsapp_otps_verified_idx" ON "whatsapp_otps"("verified");

-- Table: whatsapp_notifications (WhatsappNotification)
CREATE TABLE IF NOT EXISTS "whatsapp_notifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "phoneNumber" TEXT NOT NULL,
  "type" "WhatsappNotificationType" NOT NULL,
  "template" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" "WhatsappNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "whatsapp_notifications_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_notifications_userId_fkey') THEN
    ALTER TABLE "whatsapp_notifications" ADD CONSTRAINT "whatsapp_notifications_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "whatsapp_notifications_phoneNumber_idx" ON "whatsapp_notifications"("phoneNumber");
CREATE INDEX IF NOT EXISTS "whatsapp_notifications_status_idx" ON "whatsapp_notifications"("status");
CREATE INDEX IF NOT EXISTS "whatsapp_notifications_orderId_idx" ON "whatsapp_notifications"("orderId");
CREATE INDEX IF NOT EXISTS "whatsapp_notifications_createdAt_idx" ON "whatsapp_notifications"("createdAt");
