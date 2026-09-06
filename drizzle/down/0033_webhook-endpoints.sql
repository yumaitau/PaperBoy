DROP INDEX "webhook_endpoints_org_id_idx";
ALTER TABLE "webhook_endpoints" DROP COLUMN "enabled";
CREATE UNIQUE INDEX "webhook_endpoints_org_id_unique" ON "webhook_endpoints" USING btree ("org_id");
