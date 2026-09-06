CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_runs_status_check" CHECK ("automation_runs"."status" in ('completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'disabled' NOT NULL,
	"trigger_event" text NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"connections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automations_name_length_check" CHECK (char_length(btrim("automations"."name")) between 1 and 120),
	CONSTRAINT "automations_status_check" CHECK ("automations"."status" in ('enabled', 'disabled')),
	CONSTRAINT "automations_steps_array_check" CHECK (jsonb_typeof("automations"."steps") = 'array')
);
--> statement-breakpoint
CREATE TABLE "custom_event_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"event_id" uuid,
	"name" text NOT NULL,
	"contact_email" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_event_occurrences_payload_object_check" CHECK (jsonb_typeof("custom_event_occurrences"."payload") = 'object')
);
--> statement-breakpoint
CREATE TABLE "custom_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"schema" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_events_name_check" CHECK (char_length(btrim("custom_events"."name")) between 1 and 120 and "custom_events"."name" !~ '^resend:')
);
--> statement-breakpoint
CREATE TABLE "request_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"api_key_id" uuid,
	"environment" text,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_logs_method_check" CHECK ("request_logs"."method" in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS')),
	CONSTRAINT "request_logs_path_length_check" CHECK (char_length("request_logs"."path") between 1 and 2048)
);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_occurrence_id_custom_event_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."custom_event_occurrences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_event_occurrences" ADD CONSTRAINT "custom_event_occurrences_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_event_occurrences" ADD CONSTRAINT "custom_event_occurrences_event_id_custom_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."custom_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_events" ADD CONSTRAINT "custom_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_runs_automation_id_created_at_idx" ON "automation_runs" USING btree ("automation_id","created_at");--> statement-breakpoint
CREATE INDEX "automations_org_id_created_at_idx" ON "automations" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "automations_org_id_trigger_event_idx" ON "automations" USING btree ("org_id","trigger_event");--> statement-breakpoint
CREATE INDEX "custom_event_occurrences_org_id_name_created_at_idx" ON "custom_event_occurrences" USING btree ("org_id","name","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_events_org_id_name_unique" ON "custom_events" USING btree ("org_id",lower("name"));--> statement-breakpoint
CREATE INDEX "custom_events_org_id_created_at_idx" ON "custom_events" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "request_logs_org_id_created_at_idx" ON "request_logs" USING btree ("org_id","created_at");