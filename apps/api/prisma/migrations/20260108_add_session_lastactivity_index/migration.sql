-- CreateIndex
-- Performance improvement for session lastActivity updates
CREATE INDEX IF NOT EXISTS "sessions_lastActivity_idx" ON "sessions"("lastActivity");
