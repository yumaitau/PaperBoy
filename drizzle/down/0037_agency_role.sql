-- Throwaway-database rollback for the agency organization role.
ALTER TABLE "org_invites" DROP CONSTRAINT IF EXISTS "org_invites_role_check";
ALTER TABLE "org_members" DROP CONSTRAINT IF EXISTS "org_members_role_check";
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_role_check"
  CHECK ("org_invites"."role" in ('admin', 'member'));
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_role_check"
  CHECK ("org_members"."role" in ('owner', 'admin', 'member'));
