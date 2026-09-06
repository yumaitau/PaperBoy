import assert from "node:assert/strict";
import test from "node:test";
import { AuthorizationError } from "../src/lib/authorization.ts";
import { SegmentError } from "../src/lib/segment-core.ts";
import {
  handleCreateContactImportRequest,
  handleCreateContactPropertyRequest,
  handleCreateContactRequest,
  handleCreateSegmentRequest,
  handleCreateTopicRequest,
  handleDeleteContactRequest,
  handleDeleteSegmentRequest,
  handleDeleteTopicRequest,
  handleGetContactRequest,
  handleGetSegmentRequest,
  handleGetTopicRequest,
  handleListContactsRequest,
  handleListSegmentsRequest,
  handleListTopicsRequest,
} from "../src/lib/segment-http.ts";

const principal = {
  actorUserId: "user-one",
  apiKeyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  environment: "live",
  orgId: "11111111-1111-4111-8111-111111111111",
  scopes: null,
};
const fixedNow = new Date("2026-08-23T04:05:06.789Z");
const segment = {
  contactCount: 2,
  createdAt: fixedNow,
  id: "33333333-3333-4333-8333-333333333333",
  name: "Weekly",
  updatedAt: fixedNow,
};
const topic = {
  createdAt: fixedNow,
  defaultSubscription: "opt_in",
  description: null,
  id: "44444444-4444-4434-8344-444444444444",
  name: "News",
  updatedAt: fixedNow,
  visibility: "private",
};
const contact = {
  audienceId: null,
  createdAt: fixedNow,
  email: "reader@example.net",
  firstName: "Ada",
  id: "55555555-5555-4535-8355-555555555555",
  lastName: null,
  name: null,
  properties: {},
  segments: [],
  topics: [],
  unsubscribedAt: null,
  updatedAt: fixedNow,
};

function services(overrides = {}) {
  return {
    addContactToSegment: async () => contact,
    createContact: async () => contact,
    createContactImport: async () => ({}),
    createContactProperty: async () => ({}),
    createSegment: async () => segment,
    createTopic: async () => topic,
    deleteContact: async () => undefined,
    deleteContactProperty: async () => undefined,
    deleteSegment: async () => undefined,
    deleteTopic: async () => undefined,
    getContact: async () => contact,
    getContactImport: async () => ({}),
    getContactProperty: async () => ({}),
    getSegment: async () => segment,
    getTopic: async () => topic,
    listContactImports: async () => [],
    listContactProperties: async () => [],
    listContacts: async () => [contact],
    listSegments: async () => [segment],
    listTopics: async () => [topic],
    removeContactFromSegment: async () => contact,
    removeContactTopic: async () => contact,
    setContactTopic: async () => contact,
    updateContact: async () => contact,
    updateContactProperty: async () => ({}),
    updateContactTopics: async () => contact,
    updateSegment: async () => segment,
    updateTopic: async () => topic,
    ...overrides,
  };
}

function dependencies(overrides = {}) {
  return {
    authenticate: async (request) =>
      request.headers.get("authorization") === "Bearer valid"
        ? principal
        : null,
    services: services(),
    ...overrides,
  };
}

function request(url, method, body, authorization = "Bearer valid") {
  return new Request(url, {
    body: body === undefined ? undefined : body,
    headers: {
      Authorization: authorization,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    method,
  });
}

const segmentsUrl = "https://paperboy.test/api/v1/segments";
const topicsUrl = "https://paperboy.test/api/v1/topics";
const contactsUrl = "https://paperboy.test/api/v1/contacts";

test("segment CRUD serializes counts and stays principal-bound", async () => {
  const calls = [];
  const deps = dependencies({
    services: services({
      createSegment: async (received, payload) => {
        calls.push(["createSegment", received, payload]);
        return segment;
      },
      listSegments: async (received) => {
        calls.push(["listSegments", received]);
        return [segment];
      },
    }),
  });
  const listResponse = await handleListSegmentsRequest(
    request(segmentsUrl, "GET"),
    deps,
  );
  const createResponse = await handleCreateSegmentRequest(
    request(segmentsUrl, "POST", JSON.stringify({ name: "Weekly" })),
    deps,
  );
  const getResponse = await handleGetSegmentRequest(
    request(`${segmentsUrl}/${segment.id}`, "GET"),
    segment.id,
    deps,
  );
  const deleteResponse = await handleDeleteSegmentRequest(
    request(`${segmentsUrl}/${segment.id}`, "DELETE"),
    segment.id,
    deps,
  );

  assert.equal(listResponse.status, 200);
  assert.equal(createResponse.status, 201);
  assert.equal(getResponse.status, 200);
  assert.equal(deleteResponse.status, 200);
  assert.deepEqual((await listResponse.json()).data[0], {
    contact_count: 2,
    created_at: fixedNow.toISOString(),
    id: segment.id,
    name: "Weekly",
    updated_at: fixedNow.toISOString(),
  });
  assert.deepEqual(calls[0], ["listSegments", principal]);
  assert.deepEqual(calls[1], ["createSegment", principal, { name: "Weekly" }]);
});

test("topic and contact payloads serialize Resend-shaped fields", async () => {
  const deps = dependencies();
  const topicResponse = await handleGetTopicRequest(
    request(`${topicsUrl}/${topic.id}`, "GET"),
    topic.id,
    deps,
  );
  const contactResponse = await handleGetContactRequest(
    request(`${contactsUrl}/${contact.id}`, "GET"),
    contact.id,
    deps,
  );
  const listResponse = await handleListContactsRequest(
    request(`${contactsUrl}?segment_id=${segment.id}`, "GET"),
    deps,
  );

  assert.equal(topicResponse.status, 200);
  assert.deepEqual(await topicResponse.json(), {
    created_at: fixedNow.toISOString(),
    default_subscription: "opt_in",
    description: null,
    id: topic.id,
    name: "News",
    updated_at: fixedNow.toISOString(),
    visibility: "private",
  });
  assert.deepEqual(await contactResponse.json(), {
    audience_id: null,
    created_at: fixedNow.toISOString(),
    email: "reader@example.net",
    first_name: "Ada",
    id: contact.id,
    last_name: null,
    name: null,
    properties: {},
    segments: [],
    topics: [],
    unsubscribed_at: null,
    updated_at: fixedNow.toISOString(),
  });
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).data.length, 1);
});

test("duplicate names, unknown records, and forbidden roles are explicit", async () => {
  const exists = await handleCreateSegmentRequest(
    request(segmentsUrl, "POST", JSON.stringify({ name: "Weekly" })),
    dependencies({
      services: services({
        createSegment: async () => {
          throw new SegmentError("SEGMENT_EXISTS");
        },
      }),
    }),
  );
  const missing = await handleGetTopicRequest(
    request(`${topicsUrl}/22222222-2222-4222-8222-222222222222`, "GET"),
    "22222222-2222-4222-8222-222222222222",
    dependencies({
      services: services({
        getTopic: async () => {
          throw new SegmentError("TOPIC_NOT_FOUND");
        },
      }),
    }),
  );
  const forbidden = await handleDeleteContactRequest(
    request(`${contactsUrl}/${contact.id}`, "DELETE"),
    contact.id,
    dependencies({
      services: services({
        deleteContact: async () => {
          throw new AuthorizationError("audiences.manage");
        },
      }),
    }),
  );

  assert.equal(exists.status, 409);
  assert.equal((await exists.json()).error.code, "conflict");
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "not_found");
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).error.code, "forbidden");
});

test("contact imports accept JSON and multipart CSV uploads", async () => {
  const calls = [];
  const record = {
    createdAt: fixedNow,
    createdRows: 1,
    error: null,
    fileName: "contacts.csv",
    id: "66666666-6666-4636-8366-666666666666",
    skippedRows: 0,
    status: "completed",
    totalRows: 1,
    updatedAt: fixedNow,
    updatedRows: 0,
  };
  const deps = dependencies({
    services: services({
      createContactImport: async (received, payload) => {
        calls.push(payload);
        return record;
      },
    }),
  });
  const jsonResponse = await handleCreateContactImportRequest(
    request(contactsUrl + "/imports", "POST", JSON.stringify({ csv: "email\nreader@example.net\n" })),
    deps,
  );
  const form = new FormData();
  form.append("file", new File(["email\nreader@example.net\n"], "contacts.csv", { type: "text/csv" }));
  const multipartResponse = await handleCreateContactImportRequest(
    new Request(contactsUrl + "/imports", {
      body: form,
      headers: { Authorization: "Bearer valid" },
      method: "POST",
    }),
    deps,
  );

  assert.equal(jsonResponse.status, 201);
  assert.equal((await jsonResponse.json()).status, "completed");
  assert.equal(multipartResponse.status, 201);
  assert.equal((await multipartResponse.json()).file_name, "contacts.csv");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].file_name, "contacts.csv");
});
