-- Create pending_two_factor_sessions table (PendingTwoFactorSession model)
CREATE TABLE IF NOT EXISTS "pending_two_factor_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pending_two_factor_sessions_pkey" PRIMARY KEY ("id")
);

-- Add indexes for query performance
CREATE INDEX IF NOT EXISTS "pending_two_factor_sessions_userId_idx" ON "pending_two_factor_sessions"("userId");
CREATE INDEX IF NOT EXISTS "pending_two_factor_sessions_expiresAt_idx" ON "pending_two_factor_sessions"("expiresAt");
