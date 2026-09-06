import { requireKeyScope } from "@/lib/authorization";
import type { WebhookHttpServices } from "@/lib/webhook-http";
import {
  configureWebhookEndpoint,
  createWebhook,
  deleteWebhook,
  getWebhook,
  getWebhookEndpoint,
  getWebhookEvent,
  listWebhookEventAttempts,
  listWebhookEvents,
  listWebhooks,
  replayWebhookEvent,
  updateWebhook,
} from "@/lib/webhooks";

export const webhookApiServices: WebhookHttpServices = {
  configure: (principal, payload) => {
    requireKeyScope(principal.scopes, "webhooks.manage");
    return configureWebhookEndpoint({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
      payload,
    });
  },
  create: (principal, payload) => {
    requireKeyScope(principal.scopes, "webhooks.manage");
    return createWebhook({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
      payload,
    });
  },
  delete: (principal, webhookId) => {
    requireKeyScope(principal.scopes, "webhooks.manage");
    return deleteWebhook({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
      webhookId,
    });
  },
  get: (principal) => {
    requireKeyScope(principal.scopes, "webhooks.read");
    return getWebhookEndpoint({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
    });
  },
  getEvent: (principal, webhookId, eventId) => {
    requireKeyScope(principal.scopes, "webhooks.read");
    return getWebhookEvent({
      actorUserId: principal.actorUserId,
      eventId,
      orgId: principal.orgId,
      webhookId,
    });
  },
  getWebhook: (principal, webhookId) => {
    requireKeyScope(principal.scopes, "webhooks.read");
    return getWebhook({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
      webhookId,
    });
  },
  list: (principal) => {
    requireKeyScope(principal.scopes, "webhooks.read");
    return listWebhooks({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
    });
  },
  listEventAttempts: (principal, webhookId, eventId) => {
    requireKeyScope(principal.scopes, "webhooks.read");
    return listWebhookEventAttempts({
      actorUserId: principal.actorUserId,
      eventId,
      orgId: principal.orgId,
      webhookId,
    });
  },
  listEvents: (principal, webhookId) => {
    requireKeyScope(principal.scopes, "webhooks.read");
    return listWebhookEvents({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
      webhookId,
    });
  },
  replayEvent: (principal, webhookId, eventId) => {
    requireKeyScope(principal.scopes, "webhooks.manage");
    return replayWebhookEvent({
      actorUserId: principal.actorUserId,
      eventId,
      orgId: principal.orgId,
      webhookId,
    });
  },
  update: (principal, webhookId, payload) => {
    requireKeyScope(principal.scopes, "webhooks.manage");
    return updateWebhook({
      actorUserId: principal.actorUserId,
      orgId: principal.orgId,
      payload,
      webhookId,
    });
  },
};
