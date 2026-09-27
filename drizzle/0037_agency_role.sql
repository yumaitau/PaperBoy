ALTER TABLE "org_invites" DROP CONSTRAINT "org_invites_role_check";--> statement-breakpoint
ALTER TABLE "org_members" DROP CONSTRAINT "org_members_role_check";--> statement-breakpoint
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_role_check" CHECK ("org_invites"."role" in ('admin', 'agency', 'member'));--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_role_check" CHECK ("org_members"."role" in ('owner', 'admin', 'agency', 'member'));