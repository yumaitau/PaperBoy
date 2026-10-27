ALTER TABLE "org_invites" ADD COLUMN "token_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "org_invites_token_hash_unique" ON "org_invites" USING btree ("token_hash");--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_token_hash_check" CHECK ("org_invites"."token_hash" is null or "org_invites"."token_hash" ~ '^[0-9a-f]{64}$');