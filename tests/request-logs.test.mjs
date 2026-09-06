import assert from "node:assert/strict";
import test from "node:test";

test("withApiLog passes responses through a pre-authenticated principal", async () => {
  process.env.DATABASE_URL ??= "postgres://paperboy@127.0.0.1:5433/paperboy";

  const { withApiLog } = await import("../src/lib/request-logs.ts");
  const principal = {
    actorUserId: "user-one",
    apiKeyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    environment: "live",
    orgId: "11111111-1111-4111-8111-111111111111",
    scopes: null,
  };
  const seen = [];
  const dependencies = {
    authenticate: async () => principal,
    services: {},
  };
  const response = await withApiLog(
    new Request("https://paperboy.test/api/v1/events", {
      headers: { Authorization: "Bearer valid" },
      method: "GET",
    }),
    dependencies,
    async (scoped) => {
      seen.push(await scoped.authenticate(new Request("https://x.test/")));
      return Response.json({ data: [] }, { status: 200 });
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [] });
  assert.deepEqual(seen, [principal]);
});

test("withApiLog forwards handler errors without swallowing them", async () => {
  process.env.DATABASE_URL ??= "postgres://paperboy@127.0.0.1:5433/paperboy";

  const { withApiLog } = await import("../src/lib/request-logs.ts");
  await assert.rejects(
    withApiLog(
      new Request("https://paperboy.test/api/v1/events", { method: "GET" }),
      { authenticate: async () => null },
      async () => {
        throw new Error("boom");
      },
    ),
    /boom/,
  );
});
