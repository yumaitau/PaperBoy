import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.PAPERBOY_TEST_DATABASE_URL;
const databaseOptions = {
  skip: databaseUrl ? false : "PAPERBOY_TEST_DATABASE_URL is not configured",
};

async function withMetricsFixture(run) {
  process.env.DATABASE_URL = databaseUrl;
  const [
    { eq, inArray },
    { db },
    { domains, messages, orgMembers, orgs, users },
    { getEmailMetrics, parseMetricsQuery },
  ] = await Promise.all([
    import("drizzle-orm"),
    import("../src/db/index.ts"),
    import("../src/db/schema.ts"),
    import("../src/lib/email-metrics.ts"),
  ]);
  const orgId = randomUUID();
  const otherOrgId = randomUUID();
  const actorUserId = `metrics-${randomUUID()}`;
  const domainIds = [randomUUID(), randomUUID()];
  const broadcastIds = [randomUUID(), randomUUID()];
  const emailIds = Array.from({ length: 4 }, () => randomUUID());
  const foreignEmailId = randomUUID();
  const foreignDomainId = randomUUID();
  const rows = emailIds.map((id, index) => ({
    id,
    orgId,
    domainId: domainIds[index % 2],
    from: `sender@${index % 2 === 0 ? "alpha" : "beta"}.example.net`,
    to: ["reader@example.net"],
    subject: "Metrics ID filter regression",
    textBody: "Synthetic metrics fixture",
    createdAt: new Date("2026-10-01T12:00:00Z"),
    status: index === 1 ? "failed" : "sent",
    sentAt: index === 1 ? null : new Date("2026-10-01T12:01:00Z"),
    failedAt: index === 1 ? new Date("2026-10-01T12:01:00Z") : null,
    failureReason: index === 1 ? "Synthetic provider rejection" : null,
    // An unrelated tag with a matching value must not match broadcast_id.
    tags: [{ name: index === 3 ? "other" : "broadcast_id", value: broadcastIds[index < 2 ? 0 : 1] }],
  }));

  try {
    await db.insert(orgs).values([
      { id: orgId, name: "Metrics ID filters" },
      { id: otherOrgId, name: "Other metrics tenant" },
    ]);
    await db.insert(users).values({
      id: actorUserId,
      email: `${actorUserId}@example.net`,
      name: "Metrics operator",
    });
    await db.insert(orgMembers).values({ orgId, userId: actorUserId, role: "owner" });
    await db.insert(domains).values([
      { id: domainIds[0], orgId, name: "alpha.example.net" },
      { id: domainIds[1], orgId, name: "beta.example.net" },
      { id: foreignDomainId, orgId: otherOrgId, name: "other.example.net" },
    ]);
    await db.insert(messages).values([
      ...rows,
      { ...rows[0], id: randomUUID(), createdAt: new Date("2026-09-01T12:00:00Z") },
      { ...rows[0], id: foreignEmailId, orgId: otherOrgId, domainId: foreignDomainId },
    ]);

    const metrics = (filters = {}) => getEmailMetrics({
      actorUserId,
      orgId,
      environment: "test",
      query: parseMetricsQuery({
        start_date: "2026-10-01T00:00:00Z",
        end_date: "2026-10-02T00:00:00Z",
        metrics: "sent,failed",
        ...filters,
      }),
    });
    await run({ metrics, rows, emailIds, domainIds, broadcastIds, foreignEmailId, foreignDomainId });
  } finally {
    await db.delete(orgs).where(inArray(orgs.id, [orgId, otherOrgId]));
    await db.delete(users).where(eq(users.id, actorUserId));
  }
}

function expectedTotals(rows) {
  return { sent: rows.length, failed: rows.filter((row) => row.status === "failed").length };
}

for (const field of ["email_id", "domain_id", "broadcast_id"]) {
  test(`PostgreSQL metrics ${field} filters support one, many, and empty IDs`, databaseOptions, async () => {
    await withMetricsFixture(async ({ metrics, rows, emailIds, domainIds, broadcastIds, foreignEmailId, foreignDomainId }) => {
      const ids = { email_id: emailIds, domain_id: domainIds, broadcast_id: broadcastIds }[field];
      const matching = (selected) => rows.filter((row) => {
        if (field === "email_id") return selected.includes(row.id);
        if (field === "domain_id") return selected.includes(row.domainId);
        return row.tags.some((tag) => tag.name === "broadcast_id" && selected.includes(tag.value));
      });
      const missing = randomUUID();
      const cases = [
        ["one ID", ids[0], [ids[0]]],
        ["comma-separated IDs", `${ids[0]},${ids[1]}`, ids.slice(0, 2)],
        ["array of IDs", ids.slice(0, 2), ids.slice(0, 2)],
        ["duplicate IDs", `${ids[0]},${ids[0]}`, [ids[0]]],
        ["unknown ID", missing, []],
        ["known and unknown IDs", `${ids[0]},${missing}`, [ids[0]]],
        ["empty array", [], []],
        ["empty comma-separated list", " , ", []],
      ];
      if (field !== "broadcast_id") {
        const foreign = field === "email_id" ? foreignEmailId : foreignDomainId;
        cases.push(["foreign ID", foreign, []]);
        cases.push(["known and foreign IDs", `${ids[0]},${foreign}`, [ids[0]]]);
      }
      for (const [label, value, selected] of cases) {
        const result = await metrics({ [field]: value });
        assert.deepEqual(result.totals, expectedTotals(matching(selected)), label);
        assert.deepEqual(result.data, [], label);
      }

      const grouped = await metrics({ [field]: ids.slice(0, 2), dimensions: "period,domain" });
      const selectedRows = matching(ids.slice(0, 2));
      assert.deepEqual(grouped.totals, expectedTotals(selectedRows));
      const expectedGroups = Object.fromEntries(["alpha.example.net", "beta.example.net"].map((domain) => [
        domain,
        expectedTotals(selectedRows.filter((row) => row.from === `sender@${domain}`)),
      ]));
      assert.deepEqual(Object.fromEntries(grouped.data.map((row) => [
        row.dimensions.domain,
        Object.fromEntries(row.data.map(({ metric, value }) => [metric, value])),
      ])), expectedGroups);
    });
  });
}

test("PostgreSQL metrics combine ID filters and retain unfiltered behavior", databaseOptions, async () => {
  await withMetricsFixture(async ({ metrics, rows, emailIds, domainIds, broadcastIds }) => {
    for (const filters of [{}, { email_id: "", domain_id: "", broadcast_id: "" }]) {
      assert.deepEqual((await metrics(filters)).totals, expectedTotals(rows));
    }
    const combined = await metrics({
      email_id: emailIds.slice(0, 3),
      domain_id: domainIds[0],
      broadcast_id: broadcastIds[0],
    });
    assert.deepEqual(combined.totals, expectedTotals([rows[0]]));
    const disjoint = await metrics({ email_id: emailIds[1], domain_id: domainIds[0] });
    assert.deepEqual(disjoint.totals, expectedTotals([]));
  });
});
