CREATE TABLE "received_email_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_email_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"content_id" text,
	"byte_size" integer NOT NULL,
	"content_sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "received_email_attachments_position_check" CHECK ("received_email_attachments"."position" between 0 and 99),
	CONSTRAINT "received_email_attachments_byte_size_check" CHECK ("received_email_attachments"."byte_size" between 1 and 10485760),
	CONSTRAINT "received_email_attachments_content_sha256_check" CHECK ("received_email_attachments"."content_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "received_email_attachments_filename_length_check" CHECK (char_length("received_email_attachments"."filename") between 1 and 255),
	CONSTRAINT "received_email_attachments_content_type_check" CHECK ("received_email_attachments"."content_type" ~ '^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+$'),
	CONSTRAINT "received_email_attachments_content_id_check" CHECK ("received_email_attachments"."content_id" is null or (char_length("received_email_attachments"."content_id") between 1 and 256 and "received_email_attachments"."content_id" !~ '[[:space:]<>,]'))
);
--> statement-breakpoint
ALTER TABLE "received_email_attachments" ADD CONSTRAINT "received_email_attachments_received_email_id_received_emails_id_fk" FOREIGN KEY ("received_email_id") REFERENCES "public"."received_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "received_email_attachments_storage_key_unique" ON "received_email_attachments" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "received_email_attachments_email_id_position_unique" ON "received_email_attachments" USING btree ("received_email_id","position");--> statement-breakpoint
CREATE INDEX "received_email_attachments_email_id_idx" ON "received_email_attachments" USING btree ("received_email_id");