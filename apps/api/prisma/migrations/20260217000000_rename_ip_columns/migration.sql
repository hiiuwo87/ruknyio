-- AlterTable: Rename IP columns to IpFingerprint
ALTER TABLE "users" RENAME COLUMN "lastKnownIP" TO "lastKnownIpFingerprint";

-- AlterTable: Rename lastLoginIP to lastLoginIpFingerprint
ALTER TABLE "users" RENAME COLUMN "lastLoginIP" TO "lastLoginIpFingerprint";
