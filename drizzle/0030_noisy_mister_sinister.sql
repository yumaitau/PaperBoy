ALTER TABLE "email_templates" ADD COLUMN "react" text;--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "status" text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "published_version" integer;--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
UPDATE "email_templates" SET "published_version" = 1, "published_at" = now() WHERE "published_version" IS NULL;--> statement-breakpoint
ALTER TABLE "email_templates" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_status_check" CHECK ("email_templates"."status" in ('draft', 'published'));--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_version_check" CHECK ("email_templates"."version" >= 1);--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_published_state_check" CHECK (("email_templates"."status" = 'published' and "email_templates"."published_version" is not null and "email_templates"."published_at" is not null and "email_templates"."published_version" between 1 and "email_templates"."version") or ("email_templates"."status" <> 'published' and "email_templates"."published_version" is null and "email_templates"."published_at" is null));--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_react_length_check" CHECK ("email_templates"."react" is null or char_length("email_templates"."react") between 1 and 524288);
