import { normalizeEmailAddress } from "@/lib/email-core";
import { parseContactCsv } from "@/lib/audience-core";

export { parseContactCsv };

export const MAX_SEGMENT_NAME_LENGTH = 120;
export const MAX_TOPIC_NAME_LENGTH = 50;
export const MAX_TOPIC_DESCRIPTION_LENGTH = 200;
export const MAX_CONTACT_PROPERTY_KEY_LENGTH = 50;
export const MAX_CONTACT_PROPERTY_COUNT = 100;

export type SegmentValidationIssue = {
  field: string;
  message: string;
};

export type SegmentErrorCode =
  | "CONTACT_EXISTS"
  | "CONTACT_IMPORT_NOT_FOUND"
  | "CONTACT_NOT_FOUND"
  | "CONTACT_PROPERTY_EXISTS"
  | "CONTACT_PROPERTY_NOT_FOUND"
  | "CSV_TOO_LARGE"
  | "MEMBERSHIP_REQUIRED"
  | "SEGMENT_EXISTS"
  | "SEGMENT_NOT_FOUND"
  | "TOPIC_EXISTS"
  | "TOPIC_NOT_FOUND"
  | "VALIDATION_ERROR";

export class SegmentError extends Error {
  constructor(
    readonly code: SegmentErrorCode,
    readonly issues: SegmentValidationIssue[] = [],
  ) {
    super(code);
    this.name = "SegmentError";
  }
}

export type SegmentRecord = {
  contactCount: number;
  createdAt: Date;
  id: string;
  name: string;
  updatedAt: Date;
};

export type TopicRecord = {
  createdAt: Date;
  defaultSubscription: "opt_in" | "opt_out";
  description: string | null;
  id: string;
  name: string;
  updatedAt: Date;
  visibility: "public" | "private";
};

export type ContactPropertyRecord = {
  createdAt: Date;
  fallbackValue: string | null;
  id: string;
  key: string;
  type: "string" | "number";
  updatedAt: Date;
};

export type SegmentContactRecord = {
  audienceId: string | null;
  createdAt: Date;
  email: string;
  firstName: string | null;
  id: string;
  lastName: string | null;
  name: string | null;
  properties: Record<string, string | number | boolean>;
  segments: { id: string; name: string }[];
  topics: { id: string; name: string; subscription: "opt_in" | "opt_out" }[];
  unsubscribedAt: Date | null;
  updatedAt: Date;
};

export type ContactImportRecord = {
  createdAt: Date;
  createdRows: number;
  error: string | null;
  fileName: string | null;
  id: string;
  skippedRows: number;
  status: "queued" | "in_progress" | "completed" | "failed";
  totalRows: number;
  updatedAt: Date;
  updatedRows: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function unsupportedFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): SegmentValidationIssue[] {
  return Object.keys(value)
    .filter((field) => !allowed.has(field))
    .map((field) => ({ field, message: "This field is not supported." }));
}

function cleanName(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 &&
    name.length <= maxLength &&
    !/[\u0000-\u001f\u007f]/.test(name)
    ? name
    : null;
}

function invalid(
  field: string,
  message: string,
): SegmentValidationIssue {
  return { field, message };
}

export function parseCreateSegmentInput(value: unknown): { name: string } {
  if (!isRecord(value)) {
    throw new SegmentError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues = unsupportedFields(value, new Set(["name"]));
  const name = cleanName(value.name, MAX_SEGMENT_NAME_LENGTH);
  if (!name) {
    issues.push(
      invalid(
        "name",
        `Enter a name of at most ${MAX_SEGMENT_NAME_LENGTH} characters without control characters.`,
      ),
    );
  }
  if (issues.length > 0 || !name) {
    throw new SegmentError("VALIDATION_ERROR", issues);
  }
  return { name };
}

export const parseUpdateSegmentInput = parseCreateSegmentInput;

const TOPIC_SUBSCRIPTIONS = ["opt_in", "opt_out"] as const;
const TOPIC_VISIBILITIES = ["public", "private"] as const;

function parseTopicSubscription(value: unknown): "opt_in" | "opt_out" | null {
  return value === "opt_in" || value === "opt_out" ? value : null;
}

function parseTopicVisibility(value: unknown): "public" | "private" | null {
  return value === "public" || value === "private" ? value : null;
}

export function parseCreateTopicInput(value: unknown): {
  defaultSubscription: "opt_in" | "opt_out";
  description: string | null;
  name: string;
  visibility: "public" | "private";
} {
  if (!isRecord(value)) {
    throw new SegmentError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues = unsupportedFields(
    value,
    new Set(["default_subscription", "description", "name", "visibility"]),
  );
  const name = cleanName(value.name, MAX_TOPIC_NAME_LENGTH);
  const subscription = parseTopicSubscription(value.default_subscription);
  const visibility =
    value.visibility === undefined
      ? "private"
      : parseTopicVisibility(value.visibility);
  const description =
    value.description === undefined || value.description === null
      ? null
      : cleanName(value.description, MAX_TOPIC_DESCRIPTION_LENGTH);

  if (!name) {
    issues.push(
      invalid(
        "name",
        `Enter a name of at most ${MAX_TOPIC_NAME_LENGTH} characters without control characters.`,
      ),
    );
  }
  if (!subscription) {
    issues.push(
      invalid("default_subscription", "Must be opt_in or opt_out."),
    );
  }
  if (!visibility) {
    issues.push(invalid("visibility", "Must be public or private."));
  }
  if (
    value.description !== undefined &&
    value.description !== null &&
    description === null
  ) {
    issues.push(
      invalid(
        "description",
        `Must be at most ${MAX_TOPIC_DESCRIPTION_LENGTH} characters without control characters.`,
      ),
    );
  }
  if (
    issues.length > 0 ||
    !name ||
    !subscription ||
    !visibility ||
    description === undefined
  ) {
    throw new SegmentError("VALIDATION_ERROR", issues);
  }
  return { defaultSubscription: subscription, description, name, visibility };
}

export function parseUpdateTopicInput(value: unknown): {
  description?: string | null;
  name?: string;
  visibility?: "public" | "private";
} {
  if (!isRecord(value)) {
    throw new SegmentError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues = unsupportedFields(
    value,
    new Set(["description", "name", "visibility"]),
  );
  const result: {
    description?: string | null;
    name?: string;
    visibility?: "public" | "private";
  } = {};

  if (Object.hasOwn(value, "name")) {
    const name = cleanName(value.name, MAX_TOPIC_NAME_LENGTH);
    if (name) result.name = name;
    else {
      issues.push(
        invalid(
          "name",
          `Enter a name of at most ${MAX_TOPIC_NAME_LENGTH} characters without control characters.`,
        ),
      );
    }
  }

  if (Object.hasOwn(value, "description")) {
    if (value.description === null || value.description === "") {
      result.description = null;
    } else {
      const description = cleanName(
        value.description,
        MAX_TOPIC_DESCRIPTION_LENGTH,
      );
      if (description !== null) result.description = description;
      else {
        issues.push(
          invalid(
            "description",
            `Must be at most ${MAX_TOPIC_DESCRIPTION_LENGTH} characters without control characters.`,
          ),
        );
      }
    }
  }

  if (Object.hasOwn(value, "visibility")) {
    const visibility = parseTopicVisibility(value.visibility);
    if (visibility) result.visibility = visibility;
    else issues.push(invalid("visibility", "Must be public or private."));
  }

  if (
    result.name === undefined &&
    result.description === undefined &&
    result.visibility === undefined
  ) {
    issues.push({
      field: "body",
      message: "Provide name, description, or visibility to update.",
    });
  }
  if (issues.length > 0) throw new SegmentError("VALIDATION_ERROR", issues);
  return result;
}

const PROPERTY_KEY_PATTERN = /^[A-Za-z0-9_]{1,50}$/;

export function parseCreateContactPropertyInput(value: unknown): {
  fallbackValue: string | null;
  key: string;
  type: "string" | "number";
} {
  if (!isRecord(value)) {
    throw new SegmentError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues = unsupportedFields(
    value,
    new Set(["fallback_value", "key", "type"]),
  );
  const key =
    typeof value.key === "string" && PROPERTY_KEY_PATTERN.test(value.key)
      ? value.key
      : null;
  const type = value.type === "string" || value.type === "number" ? value.type : null;
  let fallbackValue: string | null = null;

  if (!key) {
    issues.push(
      invalid(
        "key",
        "Use up to 50 letters, numbers, and underscores.",
      ),
    );
  }
  if (!type) {
    issues.push(invalid("type", "Must be string or number."));
  }
  if (value.fallback_value !== undefined && value.fallback_value !== null) {
    if (
      (type === "string" && typeof value.fallback_value === "string") ||
      (type === "number" && typeof value.fallback_value === "number")
    ) {
      fallbackValue = String(value.fallback_value);
    } else {
      issues.push(
        invalid("fallback_value", "Must match the property type."),
      );
    }
  }
  if (issues.length > 0 || !key || !type) {
    throw new SegmentError("VALIDATION_ERROR", issues);
  }
  return { fallbackValue, key, type };
}

export function parseUpdateContactPropertyInput(value: unknown): {
  fallbackValue: string | null;
} {
  if (!isRecord(value)) {
    throw new SegmentError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues = unsupportedFields(value, new Set(["fallback_value"]));

  if (!Object.hasOwn(value, "fallback_value")) {
    issues.push(
      invalid("body", "Provide fallback_value to update."),
    );
  }

  const fallbackValue =
    value.fallback_value === null ||
    value.fallback_value === undefined ||
    value.fallback_value === ""
      ? null
      : typeof value.fallback_value === "string" ||
          typeof value.fallback_value === "number"
        ? String(value.fallback_value)
        : undefined;

  if (fallbackValue === undefined) {
    issues.push(
      invalid("fallback_value", "Must be a string, a number, or null."),
    );
  }
  if (issues.length > 0 || fallbackValue === undefined) {
    throw new SegmentError("VALIDATION_ERROR", issues);
  }
  return { fallbackValue };
}

export function contactEmail(value: unknown): string | null {
  if (typeof value !== "string" || /[<>\r\n]/.test(value)) return null;
  return normalizeEmailAddress(value.trim());
}

function personName(
  value: unknown,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const name = value.trim();
  if (!name) return null;
  return name.length <= 200 && !/[\u0000-\u001f\u007f]/.test(name)
    ? name
    : undefined;
}

export function parseContactProperties(
  value: unknown,
): Record<string, string | number | boolean> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value);
  if (entries.length > MAX_CONTACT_PROPERTY_COUNT) return undefined;

  const result: Record<string, string | number | boolean> = {};
  for (const [key, entry] of entries) {
    if (!PROPERTY_KEY_PATTERN.test(key)) return undefined;
    if (
      typeof entry !== "string" &&
      typeof entry !== "number" &&
      typeof entry !== "boolean"
    ) {
      return undefined;
    }
    result[key] = entry;
  }
  return result;
}

function parseSegmentRef(
  value: unknown,
): { id: string } | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.id,
  )
    ? { id: value.id }
    : null;
}

function parseTopicRef(
  value: unknown,
): { id: string; subscription: "opt_in" | "opt_out" } | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const subscription = parseTopicSubscription(value.subscription);
  if (!parseSegmentRef(value) || !subscription) return null;
  return { id: value.id, subscription };
}

export function parseTopLevelCreateContactInput(value: unknown): {
  email: string;
  firstName: string | null;
  lastName: string | null;
  properties: Record<string, string | number | boolean>;
  segments: { id: string }[];
  topics: { id: string; subscription: "opt_in" | "opt_out" }[];
  unsubscribed: boolean;
} {
  if (!isRecord(value)) {
    throw new SegmentError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues = unsupportedFields(
    value,
    new Set([
      "email",
      "first_name",
      "last_name",
      "properties",
      "segments",
      "topics",
      "unsubscribed",
    ]),
  );
  const email = contactEmail(value.email);
  const firstName = personName(value.first_name ?? null);
  const lastName = personName(value.last_name ?? null);
  const properties = parseContactProperties(value.properties ?? {});
  const unsubscribed =
    value.unsubscribed === undefined ? false : value.unsubscribed === true;

  if (!email) {
    issues.push(invalid("email", "Must be one plain email address."));
  }
  if (firstName === undefined) {
    issues.push(invalid("first_name", "Must be at most 200 characters."));
  }
  if (lastName === undefined) {
    issues.push(invalid("last_name", "Must be at most 200 characters."));
  }
  if (properties === undefined) {
    issues.push(
      invalid(
        "properties",
        "Use an object of up to 100 string, number, or boolean values keyed by letters, numbers, and underscores.",
      ),
    );
  }
  if (
    value.unsubscribed !== undefined &&
    value.unsubscribed !== true &&
    value.unsubscribed !== false
  ) {
    issues.push(invalid("unsubscribed", "Must be true or false."));
  }

  let segments: { id: string }[] = [];
  if (value.segments !== undefined) {
    if (!Array.isArray(value.segments)) {
      issues.push(invalid("segments", "Must be an array of segment IDs."));
    } else {
      const parsed = value.segments.map(parseSegmentRef);
      if (parsed.some((entry) => !entry)) {
        issues.push(invalid("segments", "Each entry needs a valid segment ID."));
      } else {
        segments = parsed as { id: string }[];
      }
    }
  }

  let topics: { id: string; subscription: "opt_in" | "opt_out" }[] = [];
  if (value.topics !== undefined) {
    if (!Array.isArray(value.topics)) {
      issues.push(invalid("topics", "Must be an array of topic subscriptions."));
    } else {
      const parsed = value.topics.map(parseTopicRef);
      if (parsed.some((entry) => !entry)) {
        issues.push(
          invalid(
            "topics",
            "Each entry needs a valid topic ID and an opt_in or opt_out subscription.",
          ),
        );
      } else {
        topics = parsed as { id: string; subscription: "opt_in" | "opt_out" }[];
      }
    }
  }

  if (
    issues.length > 0 ||
    !email ||
    firstName === undefined ||
    lastName === undefined ||
    properties === undefined
  ) {
    throw new SegmentError("VALIDATION_ERROR", issues);
  }
  return {
    email,
    firstName,
    lastName,
    properties,
    segments,
    topics,
    unsubscribed,
  };
}

export function parseTopLevelUpdateContactInput(value: unknown): {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  properties?: Record<string, string | number | boolean>;
  unsubscribed?: boolean;
} {
  if (!isRecord(value)) {
    throw new SegmentError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues = unsupportedFields(
    value,
    new Set(["email", "first_name", "last_name", "properties", "unsubscribed"]),
  );
  const result: {
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
    properties?: Record<string, string | number | boolean>;
    unsubscribed?: boolean;
  } = {};

  if (Object.hasOwn(value, "email")) {
    const email = contactEmail(value.email);
    if (email) result.email = email;
    else issues.push(invalid("email", "Must be one plain email address."));
  }
  if (Object.hasOwn(value, "first_name")) {
    const firstName = personName(value.first_name);
    if (firstName !== undefined) result.firstName = firstName;
    else issues.push(invalid("first_name", "Must be at most 200 characters."));
  }
  if (Object.hasOwn(value, "last_name")) {
    const lastName = personName(value.last_name);
    if (lastName !== undefined) result.lastName = lastName;
    else issues.push(invalid("last_name", "Must be at most 200 characters."));
  }
  if (Object.hasOwn(value, "properties")) {
    const properties = parseContactProperties(value.properties);
    if (properties !== undefined) result.properties = properties;
    else {
      issues.push(
        invalid(
          "properties",
          "Use an object of up to 100 string, number, or boolean values.",
        ),
      );
    }
  }
  if (Object.hasOwn(value, "unsubscribed")) {
    if (value.unsubscribed === true || value.unsubscribed === false) {
      result.unsubscribed = value.unsubscribed;
    } else {
      issues.push(invalid("unsubscribed", "Must be true or false."));
    }
  }

  if (Object.keys(result).length === 0) {
    issues.push({
      field: "body",
      message: "Provide email, a name, properties, or unsubscribed to update.",
    });
  }
  if (issues.length > 0) throw new SegmentError("VALIDATION_ERROR", issues);
  return result;
}

export function parseColumnMap(value: unknown): Record<string, string> | null {
  if (value === undefined || value === null) return {};
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed)) return null;

  const map: Record<string, string> = {};
  for (const [field, column] of Object.entries(parsed)) {
    if (
      !["email", "first_name", "last_name", "unsubscribed"].includes(field) ||
      typeof column !== "string" ||
      !column.trim()
    ) {
      return null;
    }
    map[field] = column.trim();
  }
  if (!map["email"]) return null;
  return map;
}

export function parseContactImportInput(value: unknown): {
  columnMap: Record<string, string>;
  csv: string;
  fileName: string | null;
  onConflict: "skip" | "upsert";
  segments: { id: string }[];
  topics: { id: string; subscription: "opt_in" | "opt_out" }[];
} {
  if (!isRecord(value)) {
    throw new SegmentError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues = unsupportedFields(
    value,
    new Set([
      "column_map",
      "csv",
      "file",
      "file_name",
      "on_conflict",
      "segments",
      "topics",
    ]),
  );

  const csv =
    typeof value.csv === "string"
      ? value.csv
      : typeof value.file === "string"
        ? value.file
        : null;
  if (!csv) {
    issues.push(invalid("csv", "Provide CSV text to import."));
  }

  const columnMap = parseColumnMap(value.column_map);
  if (columnMap === null) {
    issues.push(
      invalid(
        "column_map",
        "Map email, first_name, last_name, and unsubscribed to CSV column names.",
      ),
    );
  }

  const onConflict =
    value.on_conflict === undefined || value.on_conflict === null
      ? "skip"
      : value.on_conflict;
  if (onConflict !== "skip" && onConflict !== "upsert") {
    issues.push(invalid("on_conflict", "Must be skip or upsert."));
  }

  let segments: { id: string }[] = [];
  if (value.segments !== undefined && value.segments !== null) {
    let parsed: unknown = value.segments;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = null;
      }
    }
    if (!Array.isArray(parsed) || parsed.map(parseSegmentRef).some((e) => !e)) {
      issues.push(invalid("segments", "Each entry needs a valid segment ID."));
    } else {
      segments = parsed.map(parseSegmentRef) as { id: string }[];
    }
  }

  let topics: { id: string; subscription: "opt_in" | "opt_out" }[] = [];
  if (value.topics !== undefined && value.topics !== null) {
    let parsed: unknown = value.topics;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = null;
      }
    }
    if (!Array.isArray(parsed) || parsed.map(parseTopicRef).some((e) => !e)) {
      issues.push(
        invalid(
          "topics",
          "Each entry needs a valid topic ID and an opt_in or opt_out subscription.",
        ),
      );
    } else {
      topics = parsed.map(parseTopicRef) as {
        id: string;
        subscription: "opt_in" | "opt_out";
      }[];
    }
  }

  const fileName =
    typeof value.file_name === "string" && value.file_name.trim()
      ? value.file_name.trim().slice(0, 254)
      : null;

  if (issues.length > 0 || !csv || !columnMap || !onConflict) {
    throw new SegmentError("VALIDATION_ERROR", issues);
  }
  return {
    columnMap,
    csv,
    fileName,
    onConflict: onConflict as "skip" | "upsert",
    segments,
    topics,
  };
}
