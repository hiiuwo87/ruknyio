-- Sync database with current schema
-- This migration brings the database in sync with the Prisma schema

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "FileCategory" AS ENUM ('AVATAR', 'COVER', 'FORM_COVER', 'FORM_BANNER', 'FORM_SUBMISSION', 'EVENT_COVER', 'EVENT_GALLERY', 'PRODUCT_IMAGE', 'BANNER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum - Add new FieldType values if not exist
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'URL'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'MULTISELECT'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'RANKING'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'HEADING'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'PARAGRAPH'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'DIVIDER'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'TITLE'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'LABEL'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'IMAGE'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'VIDEO'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'AUDIO'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'EMBED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'CONDITIONAL_LOGIC'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'CALCULATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'HIDDEN'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'RECAPTCHA'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterEnum - Add InvitationStatus value
DO $$ BEGIN ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'CANCELLED'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterEnum - Add NotificationType values
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TODO_OVERDUE'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TODO_REMINDER'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TODO_DAILY_REMINDER'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TODO_DUE_SOON'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterEnum - Add SecurityAction values
DO $$ BEGIN ALTER TYPE "SecurityAction" ADD VALUE IF NOT EXISTS 'TWO_FACTOR_SETUP_STARTED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "SecurityAction" ADD VALUE IF NOT EXISTS 'TWO_FACTOR_ENABLED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "SecurityAction" ADD VALUE IF NOT EXISTS 'TWO_FACTOR_DISABLED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "SecurityAction" ADD VALUE IF NOT EXISTS 'TWO_FACTOR_FAILED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "SecurityAction" ADD VALUE IF NOT EXISTS 'TWO_FACTOR_BACKUP_REGENERATED'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "SecurityAction" ADD VALUE IF NOT EXISTS 'SECURITY_SETTINGS_CHANGED'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable addresses
ALTER TABLE "addresses" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
UPDATE "orders" SET "phoneNumber" = '' WHERE "phoneNumber" IS NULL;
ALTER TABLE "orders" ALTER COLUMN "phoneNumber" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable profiles
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "storageLimit" BIGINT NOT NULL DEFAULT 5368709120;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "storageUsed" BIGINT NOT NULL DEFAULT 0;

-- AlterTable security_preferences
ALTER TABLE "security_preferences" ADD COLUMN IF NOT EXISTS "alertOnNewIP" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "security_preferences" ADD COLUMN IF NOT EXISTS "trustedIpFingerprints" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable social_links
ALTER TABLE "social_links" ADD COLUMN IF NOT EXISTS "layout" TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE "social_links" ADD COLUMN IF NOT EXISTS "thumbnail" TEXT;

-- AlterTable stores
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "employeesCount" TEXT;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- AlterTable users - THIS IS THE KEY FIX
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bannerUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ALTER COLUMN "phoneVerified" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "accountType" SET NOT NULL;

-- Drop form_email_verifications if exists (from orphaned migration)
DROP TABLE IF EXISTS "form_email_verifications";

-- CreateTable user_files
CREATE TABLE IF NOT EXISTS "user_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "category" "FileCategory" NOT NULL,
    "entityId" TEXT,
    "blurHash" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "user_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable two_factor_backup_codes
CREATE TABLE IF NOT EXISTS "two_factor_backup_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_files_key_key" ON "user_files"("key");
CREATE INDEX IF NOT EXISTS "user_files_userId_idx" ON "user_files"("userId");
CREATE INDEX IF NOT EXISTS "user_files_category_idx" ON "user_files"("category");
CREATE INDEX IF NOT EXISTS "user_files_entityId_idx" ON "user_files"("entityId");
CREATE INDEX IF NOT EXISTS "user_files_deletedAt_idx" ON "user_files"("deletedAt");
CREATE INDEX IF NOT EXISTS "two_factor_backup_codes_userId_idx" ON "two_factor_backup_codes"("userId");
CREATE INDEX IF NOT EXISTS "two_factor_backup_codes_codeHash_idx" ON "two_factor_backup_codes"("codeHash");
CREATE INDEX IF NOT EXISTS "addresses_phoneNumber_idx" ON "addresses"("phoneNumber");
CREATE INDEX IF NOT EXISTS "events_userId_status_startDate_idx" ON "events"("userId", "status", "startDate");
CREATE INDEX IF NOT EXISTS "events_categoryId_status_startDate_idx" ON "events"("categoryId", "status", "startDate");
CREATE INDEX IF NOT EXISTS "events_status_isFeatured_startDate_idx" ON "events"("status", "isFeatured", "startDate");
CREATE INDEX IF NOT EXISTS "form_submissions_formId_completedAt_idx" ON "form_submissions"("formId", "completedAt" DESC);
CREATE INDEX IF NOT EXISTS "form_submissions_formId_userId_idx" ON "form_submissions"("formId", "userId");
CREATE INDEX IF NOT EXISTS "forms_userId_status_createdAt_idx" ON "forms"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "forms_type_status_createdAt_idx" ON "forms"("type", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_phoneNumber_idx" ON "orders"("phoneNumber");
CREATE INDEX IF NOT EXISTS "products_storeId_status_createdAt_idx" ON "products"("storeId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "products_storeId_isFeatured_status_idx" ON "products"("storeId", "isFeatured", "status");
CREATE INDEX IF NOT EXISTS "products_categoryId_status_createdAt_idx" ON "products"("categoryId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "profiles_username_idx" ON "profiles"("username");
CREATE INDEX IF NOT EXISTS "profiles_userId_idx" ON "profiles"("userId");
CREATE INDEX IF NOT EXISTS "sessions_previousRefreshTokenHash_isRevoked_idx" ON "sessions"("previousRefreshTokenHash", "isRevoked");
CREATE INDEX IF NOT EXISTS "sessions_expiresAt_idx" ON "sessions"("expiresAt");
CREATE INDEX IF NOT EXISTS "sessions_revokedAt_idx" ON "sessions"("revokedAt");
CREATE INDEX IF NOT EXISTS "social_links_profileId_idx" ON "social_links"("profileId");
CREATE INDEX IF NOT EXISTS "social_links_profileId_displayOrder_idx" ON "social_links"("profileId", "displayOrder");
CREATE INDEX IF NOT EXISTS "social_links_status_idx" ON "social_links"("status");
CREATE INDEX IF NOT EXISTS "stores_status_createdAt_idx" ON "stores"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "users_email_role_idx" ON "users"("email", "role");
CREATE INDEX IF NOT EXISTS "users_createdAt_idx" ON "users"("createdAt");
CREATE INDEX IF NOT EXISTS "users_updatedAt_idx" ON "users"("updatedAt");
CREATE INDEX IF NOT EXISTS "users_lastLoginAt_idx" ON "users"("lastLoginAt");

-- AddForeignKey user_files
DO $$ BEGIN
    ALTER TABLE "user_files" ADD CONSTRAINT "user_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey two_factor_backup_codes
DO $$ BEGIN
    ALTER TABLE "two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Delete orphaned migration record
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260212000000_add_form_email_verifications';
