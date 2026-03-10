-- Add missing bannerImages and bannerDisplayMode columns to forms table
ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "bannerImages" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "bannerDisplayMode" TEXT DEFAULT 'single';
