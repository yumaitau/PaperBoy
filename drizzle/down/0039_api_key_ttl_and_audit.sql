-- Rollback drops audit history and expiry settings. Keys hard-deleted while
-- this migration was live stay deleted.
DROP TABLE "api_key_audit_events";
--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "expires_at";
--> statement-breakpoint
ALTER TABLE "broadcasts" DROP CONSTRAINT "broadcasts_api_key_id_api_keys_id_fk";
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE restrict ON UPDATE no action;
