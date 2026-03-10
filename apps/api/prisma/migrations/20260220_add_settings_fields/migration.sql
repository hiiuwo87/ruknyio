-- AlterTable: Add deactivation fields to users
ALTER TABLE "users" ADD COLUMN "isDeactivated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- AlterTable: Add privacy & location fields to profiles
ALTER TABLE "profiles" ADD COLUMN "hideEmail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "profiles" ADD COLUMN "hidePhone" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "profiles" ADD COLUMN "hideLocation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "profiles" ADD COLUMN "location" TEXT;

-- AlterEnum: Add new SecurityAction values
ALTER TYPE "SecurityAction" ADD VALUE 'ACCOUNT_DEACTIVATED';
ALTER TYPE "SecurityAction" ADD VALUE 'ACCOUNT_REACTIVATED';
ALTER TYPE "SecurityAction" ADD VALUE 'ACCOUNT_DELETED';
