import type { ApiKeyPrincipal } from "@/lib/api-key-auth";
import { requireKeyScope, type OrgPermission } from "@/lib/authorization";
import { TemplateError } from "@/lib/template-core";
import type { TemplateHttpServices } from "@/lib/template-http";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplate,
  listTemplates,
  previewStoredTemplate,
  publishTemplate,
  updateTemplate,
} from "@/lib/templates";

function actorUserId(
  principal: ApiKeyPrincipal,
  permission: OrgPermission,
): string {
  if (!principal.actorUserId) {
    throw new TemplateError("MEMBERSHIP_REQUIRED");
  }

  requireKeyScope(principal.scopes, permission);

  return principal.actorUserId;
}

export const templateApiServices: TemplateHttpServices = {
  create: (principal, payload) =>
    createTemplate({
      actorUserId: actorUserId(principal, "templates.create"),
      orgId: principal.orgId,
      payload,
    }),
  delete: (principal, templateId) =>
    deleteTemplate({
      actorUserId: actorUserId(principal, "templates.delete"),
      orgId: principal.orgId,
      templateId,
    }),
  duplicate: (principal, templateId) =>
    duplicateTemplate({
      actorUserId: actorUserId(principal, "templates.create"),
      orgId: principal.orgId,
      templateId,
    }),
  get: (principal, templateId) =>
    getTemplate({
      actorUserId: actorUserId(principal, "templates.read"),
      orgId: principal.orgId,
      templateId,
    }),
  list: (principal) =>
    listTemplates({
      actorUserId: actorUserId(principal, "templates.read"),
      orgId: principal.orgId,
    }),
  preview: (principal, templateId, data) =>
    previewStoredTemplate({
      actorUserId: actorUserId(principal, "templates.read"),
      data,
      orgId: principal.orgId,
      templateId,
    }),
  publish: (principal, templateId) =>
    publishTemplate({
      actorUserId: actorUserId(principal, "templates.update"),
      orgId: principal.orgId,
      templateId,
    }),
  update: (principal, templateId, payload) =>
    updateTemplate({
      actorUserId: actorUserId(principal, "templates.update"),
      orgId: principal.orgId,
      payload,
      templateId,
    }),
};
