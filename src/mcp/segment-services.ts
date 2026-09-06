import { segmentApiServices } from "@/lib/segment-http";
import type {
  PaperBoyMcpSegmentServices,
  SegmentContactInput,
} from "@/mcp/segment-tools";

function contactPayload(input: SegmentContactInput): Record<string, unknown> {
  return {
    email: input.email,
    ...(input.firstName !== undefined ? { first_name: input.firstName } : {}),
    ...(input.lastName !== undefined ? { last_name: input.lastName } : {}),
    ...(input.properties !== undefined ? { properties: input.properties } : {}),
    ...(input.segments !== undefined ? { segments: input.segments } : {}),
    ...(input.topics !== undefined ? { topics: input.topics } : {}),
    ...(input.unsubscribed !== undefined
      ? { unsubscribed: input.unsubscribed }
      : {}),
  };
}

export const paperBoyMcpSegmentServices: PaperBoyMcpSegmentServices = {
  addContactToSegment: segmentApiServices.addContactToSegment,
  createContact: (principal, input) =>
    segmentApiServices.createContact(principal, contactPayload(input)),
  createContactImport: (principal, input) =>
    segmentApiServices.createContactImport(principal, {
      column_map: input["columnMap"] ?? input["column_map"],
      csv: input["csv"],
      file_name: input["fileName"] ?? input["file_name"] ?? null,
      on_conflict: input["onConflict"] ?? input["on_conflict"] ?? "skip",
      segments: input["segments"] ?? [],
      topics: input["topics"] ?? [],
    }),
  createContactProperty: (principal, input) =>
    segmentApiServices.createContactProperty(principal, {
      fallback_value: input["fallbackValue"] ?? input["fallback_value"] ?? null,
      key: input["key"],
      type: input["type"],
    }),
  createSegment: (principal, input) =>
    segmentApiServices.createSegment(principal, input),
  createTopic: (principal, input) =>
    segmentApiServices.createTopic(principal, {
      default_subscription:
        input["defaultSubscription"] ?? input["default_subscription"],
      description: input["description"] ?? null,
      name: input["name"],
      visibility: input["visibility"] ?? "private",
    }),
  deleteContact: segmentApiServices.deleteContact,
  deleteContactProperty: segmentApiServices.deleteContactProperty,
  deleteSegment: segmentApiServices.deleteSegment,
  deleteTopic: segmentApiServices.deleteTopic,
  getContact: segmentApiServices.getContact,
  getContactImport: segmentApiServices.getContactImport,
  getContactProperty: segmentApiServices.getContactProperty,
  getSegment: segmentApiServices.getSegment,
  getTopic: segmentApiServices.getTopic,
  listContactImports: segmentApiServices.listContactImports,
  listContactProperties: segmentApiServices.listContactProperties,
  listContacts: segmentApiServices.listContacts,
  listSegments: segmentApiServices.listSegments,
  listTopics: segmentApiServices.listTopics,
  removeContactFromSegment: segmentApiServices.removeContactFromSegment,
  updateContact: (principal, contactId, input) =>
    segmentApiServices.updateContact(principal, contactId, {
      ...(input["email"] === undefined ? {} : { email: input["email"] }),
      ...(input["firstName"] === undefined
        ? {}
        : { first_name: input["firstName"] }),
      ...(input["lastName"] === undefined
        ? {}
        : { last_name: input["lastName"] }),
      ...(input["properties"] === undefined
        ? {}
        : { properties: input["properties"] }),
      ...(input["unsubscribed"] === undefined
        ? {}
        : { unsubscribed: input["unsubscribed"] }),
    }),
  updateContactProperty: (principal, propertyId, input) =>
    segmentApiServices.updateContactProperty(principal, propertyId, {
      fallback_value:
        input["fallbackValue"] ?? input["fallback_value"] ?? null,
    }),
  updateContactTopics: (principal, contactId, input) =>
    segmentApiServices.updateContactTopics(principal, contactId, {
      topics: input["topics"] ?? [],
    }),
  updateSegment: (principal, segmentId, input) =>
    segmentApiServices.updateSegment(principal, segmentId, input),
  updateTopic: (principal, topicId, input) =>
    segmentApiServices.updateTopic(principal, topicId, input),
};
