DROP INDEX "webhook_deliveries_event_id_unique";--> statement-breakpoint
DROP INDEX "webhook_deliveries_received_email_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_event_endpoint_unique" ON "webhook_deliveries" USING btree ("event_id","endpoint_id") WHERE "webhook_deliveries"."event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_received_email_endpoint_unique" ON "webhook_deliveries" USING btree ("received_email_id","endpoint_id") WHERE "webhook_deliveries"."received_email_id" is not null;