-- Add missing indexes to improve DELETE query performance
-- These tables are cleaned up hourly and need better index coverage

-- quicksign_links: Add missing indexes for cleanup queries
CREATE INDEX IF NOT EXISTS "quicksign_links_expiresAt_idx" ON "quicksign_links"("expiresAt");
CREATE INDEX IF NOT EXISTS "quicksign_links_used_idx" ON "quicksign_links"("used");
CREATE INDEX IF NOT EXISTS "quicksign_links_usedAt_idx" ON "quicksign_links"("usedAt");

-- Composite indexes for OR conditions in cleanup queries (improves JSON planning)
CREATE INDEX IF NOT EXISTS "whatsapp_otps_verified_createdAt_idx" ON "whatsapp_otps"("verified", "createdAt") WHERE "verified" = true;
CREATE INDEX IF NOT EXISTS "verification_codes_verified_verifiedAt_idx" ON "verification_codes"("verified", "verifiedAt") WHERE "verified" = true;
CREATE INDEX IF NOT EXISTS "quicksign_links_used_usedAt_idx" ON "quicksign_links"("used", "usedAt") WHERE "used" = true;
