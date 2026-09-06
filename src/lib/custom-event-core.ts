export type CustomEventValidationIssue = {
  field: string;
  message: string;
};

export type CustomEventErrorCode =
  | "EVENT_EXISTS"
  | "EVENT_NOT_FOUND"
  | "MEMBERSHIP_REQUIRED"
  | "VALIDATION_ERROR";

export class CustomEventError extends Error {
  constructor(
    readonly code: CustomEventErrorCode,
    readonly issues: CustomEventValidationIssue[] = [],
  ) {
    super(code);
    this.name = "CustomEventError";
  }
}

export type EventDefinitionRecord = {
  createdAt: Date;
  id: string;
  name: string;
  schema: Record<string, "string" | "number" | "boolean" | "date"> | null;
  updatedAt: Date;
};

export type EventOccurrenceRecord = {
  contactEmail: string | null;
  createdAt: Date;
  eventId: string | null;
  id: string;
  name: string;
  payload: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalid(field: string, message: string) {
  return { field, message };
}

function eventName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 &&
    name.length <= 120 &&
    !/[\u0000-\u001f\u007f]/.test(name) &&
    !name.toLowerCase().startsWith("resend:")
    ? name
    : null;
}

const SCHEMA_TYPES = ["string", "number", "boolean", "date"] as const;

function eventSchema(
  value: unknown,
): Record<string, "string" | "number" | "boolean" | "date"> | null | undefined {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value);
  if (entries.length > 100) return undefined;

  const result: Record<string, "string" | "number" | "boolean" | "date"> = {};
  for (const [key, type] of entries) {
    if (
      !/^[A-Za-z0-9_]{1,50}$/.test(key) ||
      typeof type !== "string" ||
      !(SCHEMA_TYPES as readonly string[]).includes(type)
    ) {
      return undefined;
    }
    result[key] = type as "string" | "number" | "boolean" | "date";
  }
  return result;
}

export function parseCreateEventInput(value: unknown): {
  name: string;
  schema: Record<string, "string" | "number" | "boolean" | "date"> | null;
} {
  if (!isRecord(value)) {
    throw new CustomEventError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues: CustomEventValidationIssue[] = [];
  for (const field of Object.keys(value)) {
    if (field !== "name" && field !== "schema") {
      issues.push(invalid(field, "This field is not supported."));
    }
  }

  const name = eventName(value.name);
  const schema = eventSchema(value.schema);

  if (!name) {
    issues.push(
      invalid(
        "name",
        "Enter a name of 1-120 characters. Names cannot start with resend:.",
      ),
    );
  }
  if (schema === undefined) {
    issues.push(
      invalid(
        "schema",
        "Use a flat map of keys to string, number, boolean, or date.",
      ),
    );
  }
  if (issues.length > 0 || !name || schema === undefined) {
    throw new CustomEventError("VALIDATION_ERROR", issues);
  }
  return { name, schema };
}

export function parseUpdateEventInput(value: unknown): {
  name?: string;
  schema?: Record<string, "string" | "number" | "boolean" | "date"> | null;
} {
  if (!isRecord(value)) {
    throw new CustomEventError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues: CustomEventValidationIssue[] = [];
  const result: {
    name?: string;
    schema?: Record<string, "string" | "number" | "boolean" | "date"> | null;
  } = {};

  if (Object.hasOwn(value, "name")) {
    const name = eventName(value.name);
    if (name) result.name = name;
    else {
      issues.push(
        invalid(
          "name",
          "Enter a name of 1-120 characters. Names cannot start with resend:.",
        ),
      );
    }
  }

  if (Object.hasOwn(value, "schema")) {
    const schema = eventSchema(value.schema);
    if (schema !== undefined) result.schema = schema;
    else {
      issues.push(
        invalid(
          "schema",
          "Use a flat map of keys to string, number, boolean, or date.",
        ),
      );
    }
  }

  if (result.name === undefined && result.schema === undefined) {
    issues.push(invalid("body", "Provide name or schema to update."));
  }
  if (issues.length > 0) throw new CustomEventError("VALIDATION_ERROR", issues);
  return result;
}

export function parseSendEventInput(value: unknown): {
  contactId?: string;
  email?: string;
  event: string;
  payload: Record<string, unknown>;
} {
  if (!isRecord(value)) {
    throw new CustomEventError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues: CustomEventValidationIssue[] = [];
  for (const field of Object.keys(value)) {
    if (!["contact_id", "email", "event", "payload"].includes(field)) {
      issues.push(invalid(field, "This field is not supported."));
    }
  }

  const event = typeof value.event === "string" ? value.event.trim() : "";
  if (!event) {
    issues.push(invalid("event", "Provide the event name to send."));
  }

  const hasContactId = value.contact_id !== undefined && value.contact_id !== null;
  const hasEmail = value.email !== undefined && value.email !== null;

  if (hasContactId === hasEmail) {
    issues.push(
      invalid(
        "contact_id",
        "Provide exactly one of contact_id or email.",
      ),
    );
  }

  let contactId: string | undefined;
  let email: string | undefined;

  if (hasContactId) {
    if (
      typeof value.contact_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value.contact_id,
      )
    ) {
      issues.push(invalid("contact_id", "Provide a valid contact UUID."));
    } else {
      contactId = value.contact_id;
    }
  }

  if (hasEmail) {
    if (
      typeof value.email !== "string" ||
      value.email.length < 3 ||
      value.email.length > 254 ||
      !/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(value.email.trim())
    ) {
      issues.push(invalid("email", "Provide a valid email address."));
    } else {
      email = value.email.trim().toLowerCase();
    }
  }

  let payload: Record<string, unknown> = {};
  if (value.payload !== undefined && value.payload !== null) {
    if (!isRecord(value.payload)) {
      issues.push(invalid("payload", "Use an object of key/value pairs."));
    } else {
      payload = value.payload;
    }
  }

  if (issues.length > 0) throw new CustomEventError("VALIDATION_ERROR", issues);
  return { ...(contactId ? { contactId } : {}), ...(email ? { email } : {}), event, payload };
}

export function validateEventPayload(
  schema: Record<string, "string" | "number" | "boolean" | "date"> | null,
  payload: Record<string, unknown>,
): CustomEventValidationIssue[] {
  if (!schema) return [];

  const issues: CustomEventValidationIssue[] = [];
  for (const [key, type] of Object.entries(schema)) {
    const entry = payload[key];
    if (entry === undefined) continue;

    const ok =
      type === "string"
        ? typeof entry === "string"
        : type === "number"
          ? typeof entry === "number"
          : type === "boolean"
            ? typeof entry === "boolean"
            : typeof entry === "string" && !Number.isNaN(Date.parse(entry));

    if (!ok) {
      issues.push(invalid(`payload.${key}`, `Must be a ${type}.`));
    }
  }
  return issues;
}
