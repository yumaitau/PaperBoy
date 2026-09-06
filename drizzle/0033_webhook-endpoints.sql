DROP INDEX "webhook_endpoints_org_id_unique";--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "webhook_endpoints_org_id_idx" ON "webhook_endpoints" USING btree ("org_id");