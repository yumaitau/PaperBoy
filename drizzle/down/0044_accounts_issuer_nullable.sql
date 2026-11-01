-- Rollback restores NOT NULL on issuer. Rows created by Better Auth 1.7.7 have
-- no issuer, so backfill them first or the SET NOT NULL fails.
UPDATE "accounts" SET "issuer" = "provider_id" WHERE "issuer" IS NULL;
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "issuer" SET NOT NULL;
