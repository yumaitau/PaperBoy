CREATE TABLE "api_key_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text,
	"via_api_key_id" uuid,
	"key_name" text NOT NULL,
	"key_public_id" text NOT NULL,
	"environment" text NOT NULL,
	"scopes" text[],
	"expires_at" timestamp with time zone,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_audit_events_action_check" CHECK ("api_key_audit_events"."action" in ('created', 'updated', 'revoked', 'deleted'))
);
--> statement-breakpoint
ALTER TABLE "broadcasts" DROP CONSTRAINT "broadcasts_api_key_id_api_keys_id_fk";
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_key_audit_events" ADD CONSTRAINT "api_key_audit_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_audit_events" ADD CONSTRAINT "api_key_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_key_audit_events_org_created_idx" ON "api_key_audit_events" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "api_key_audit_events_api_key_id_idx" ON "api_key_audit_events" USING btree ("api_key_id");--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;