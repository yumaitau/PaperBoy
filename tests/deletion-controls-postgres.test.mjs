import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { mock } from "bun:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;

test(
  "finished broadcasts and segments delete only with delete permissions",
  { skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured" },
  async () => {
    process.env.DATABASE_URL = databaseUrl;
    mock.module("server-only", () => ({}));
    const [
      { eq },
      { db },
      { broadcasts, orgMembers, orgs, users },
      { AuthorizationError },
      { deleteBroadcast },
      { createSegment, deleteSegment, listSegments },
    ] = await Promise.all([
      import("drizzle-orm"),
      import("../src/db/index.ts"),
      import("../src/db/schema.ts"),
      import("../src/lib/authorization.ts"),
      import("../src/lib/broadcasts.ts"),
      import("../src/lib/segments.ts"),
    ]);
    const orgId = randomUUID();
    const otherOrgId = randomUUID();
    const adminId = randomUUID();
    const agencyId = randomUUID();
    try {
      await db.insert(orgs).values([
        { id: orgId, name: "Deletion controls" },
        { id: otherOrgId, name: "Other tenant" },
      ]);
      await db.insert(users).values([adminId, agencyId].map((id) => ({
        id, email: `${id}@example.com`, name: "Deletion tester",
      })));
      await db.insert(orgMembers).values([
        { orgId, userId: adminId, role: "admin" },
        { orgId, userId: agencyId, role: "agency" },
      ]);

      const rows = await db.insert(broadcasts).values(
        ["scheduled", "running", "paused", "completed", "cancelled"].map((status) => ({
          orgId, createdByUserId: adminId, name: `Broadcast ${status}`,
          from: "sender@example.com", templateName: "Example",
          templateSubject: "Example", templateText: "Example",
          environment: "test", status,
          scheduledFor: status === "scheduled" ? new Date(Date.now() + 86_400_000) : null,
        })),
      ).returning({ id: broadcasts.id, status: broadcasts.status });
      const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.id]));
      const admin = { actorUserId: adminId, orgId };

      await assert.rejects(
        deleteBroadcast({ ...admin, actorUserId: agencyId, broadcastId: byStatus.completed }),
        AuthorizationError,
      );
      for (const status of ["running", "paused"]) {
        await assert.rejects(
          deleteBroadcast({ ...admin, broadcastId: byStatus[status] }),
          { code: "INVALID_TRANSITION" },
        );
      }
      await assert.rejects(
        deleteBroadcast({ ...admin, orgId: otherOrgId, broadcastId: byStatus.completed }),
      );
      for (const status of ["scheduled", "completed", "cancelled"]) {
        await deleteBroadcast({ ...admin, broadcastId: byStatus[status] });
      }
      await assert.rejects(
        deleteBroadcast({ ...admin, broadcastId: byStatus.completed }),
        { code: "BROADCAST_NOT_FOUND" },
      );
      const remaining = await db
        .select({ status: broadcasts.status })
        .from(broadcasts)
        .where(eq(broadcasts.orgId, orgId));
      assert.deepEqual(remaining.map((row) => row.status).sort(), ["paused", "running"]);

      const segment = await createSegment({
        ...admin,
        payload: { name: "Deletion segment" },
      });
      await assert.rejects(
        deleteSegment({ ...admin, actorUserId: agencyId, segmentId: segment.id }),
        AuthorizationError,
      );
      await deleteSegment({ ...admin, segmentId: segment.id });
      assert.deepEqual(await listSegments(admin), []);
    } finally {
      await db.delete(orgs).where(eq(orgs.id, orgId));
      await db.delete(orgs).where(eq(orgs.id, otherOrgId));
      for (const id of [adminId, agencyId]) {
        await db.delete(users).where(eq(users.id, id));
      }
    }
  },
);
