DROP INDEX "received_emails_org_id_content_sha256_unique";--> statement-breakpoint
DROP INDEX "received_emails_org_id_rfc822_message_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "received_emails_org_environment_content_sha256_unique" ON "received_emails" USING btree ("org_id","environment","content_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "received_emails_org_environment_rfc822_message_id_unique" ON "received_emails" USING btree ("org_id","environment","rfc822_message_id") WHERE "received_emails"."rfc822_message_id" is not null;