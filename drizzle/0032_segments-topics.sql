CREATE TABLE "contact_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"file_name" text,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"created_rows" integer DEFAULT 0 NOT NULL,
	"updated_rows" integer DEFAULT 0 NOT NULL,
	"skipped_rows" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_imports_status_check" CHECK ("contact_imports"."status" in ('queued', 'in_progress', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "contact_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"fallback_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_properties_key_check" CHECK ("contact_properties"."key" ~ '^[A-Za-z0-9_]{1,50}$'),
	CONSTRAINT "contact_properties_type_check" CHECK ("contact_properties"."type" in ('string', 'number'))
);
--> statement-breakpoint
CREATE TABLE "contact_segments" (
	"contact_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_topics" (
	"contact_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"subscription" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_topics_subscription_check" CHECK ("contact_topics"."subscription" in ('opt_in', 'opt_out'))
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "segments_name_length_check" CHECK (char_length(btrim("segments"."name")) between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"default_subscription" text NOT NULL,
	"description" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_name_length_check" CHECK (char_length(btrim("topics"."name")) between 1 and 50),
	CONSTRAINT "topics_default_subscription_check" CHECK ("topics"."default_subscription" in ('opt_in', 'opt_out')),
	CONSTRAINT "topics_description_length_check" CHECK ("topics"."description" is null or char_length("topics"."description") between 1 and 200),
	CONSTRAINT "topics_visibility_check" CHECK ("topics"."visibility" in ('public', 'private'))
);
--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "audience_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "org_id" uuid;--> statement-breakpoint
UPDATE "contacts" SET "org_id" = "audiences"."org_id" FROM "audiences" WHERE "audiences"."id" = "contacts"."audience_id";--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "properties" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_imports" ADD CONSTRAINT "contact_imports_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_properties" ADD CONSTRAINT "contact_properties_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_segments" ADD CONSTRAINT "contact_segments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_segments" ADD CONSTRAINT "contact_segments_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_topics" ADD CONSTRAINT "contact_topics_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_topics" ADD CONSTRAINT "contact_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_imports_org_id_created_at_idx" ON "contact_imports" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_properties_org_id_key_unique" ON "contact_properties" USING btree ("org_id",lower("key"));--> statement-breakpoint
CREATE INDEX "contact_properties_org_id_idx" ON "contact_properties" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_segments_contact_id_segment_id_unique" ON "contact_segments" USING btree ("contact_id","segment_id");--> statement-breakpoint
CREATE INDEX "contact_segments_segment_id_idx" ON "contact_segments" USING btree ("segment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_topics_contact_id_topic_id_unique" ON "contact_topics" USING btree ("contact_id","topic_id");--> statement-breakpoint
CREATE INDEX "contact_topics_topic_id_idx" ON "contact_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "segments_org_id_name_unique" ON "segments" USING btree ("org_id",lower("name"));--> statement-breakpoint
CREATE INDEX "segments_org_id_created_at_idx" ON "segments" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_org_id_name_unique" ON "topics" USING btree ("org_id",lower("name"));--> statement-breakpoint
CREATE INDEX "topics_org_id_created_at_idx" ON "topics" USING btree ("org_id","created_at");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_org_id_email_unique" ON "contacts" USING btree ("org_id",lower("email")) WHERE "contacts"."audience_id" is null;--> statement-breakpoint
CREATE INDEX "contacts_org_id_idx" ON "contacts" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_first_name_length_check" CHECK ("contacts"."first_name" is null or char_length(btrim("contacts"."first_name")) between 1 and 200);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_last_name_length_check" CHECK ("contacts"."last_name" is null or char_length(btrim("contacts"."last_name")) between 1 and 200);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_properties_object_check" CHECK (jsonb_typeof("contacts"."properties") = 'object');