export type AutomationValidationIssue = {
  field: string;
  message: string;
};

export type AutomationErrorCode =
  | "AUTOMATION_EXISTS"
  | "AUTOMATION_NOT_FOUND"
  | "MEMBERSHIP_REQUIRED"
  | "RUN_NOT_FOUND"
  | "VALIDATION_ERROR";

export class AutomationError extends Error {
  constructor(
    readonly code: AutomationErrorCode,
    readonly issues: AutomationValidationIssue[] = [],
  ) {
    super(code);
    this.name = "AutomationError";
  }
}

export type AutomationRecord = {
  createdAt: Date;
  id: string;
  name: string;
  status: "enabled" | "disabled";
  steps: unknown[];
  connections: unknown[];
  triggerEvent: string;
  updatedAt: Date;
};

export type AutomationRunRecord = {
  automationId: string;
  createdAt: Date;
  id: string;
  occurrenceId: string | null;
  status: "completed" | "failed";
  updatedAt: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalid(field: string, message: string) {
  return { field, message };
}

function automationName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length > 0 && name.length <= 120 && !/[\u0000-\u001f\u007f]/.test(name)
    ? name
    : null;
}

function automationStatus(value: unknown): "enabled" | "disabled" | null {
  return value === "enabled" || value === "disabled" ? value : null;
}

function triggerEventFromSteps(steps: unknown[]): string | null {
  for (const step of steps) {
    if (!isRecord(step)) continue;
    if (step["type"] !== "trigger") continue;

    const event =
      typeof step["event"] === "string" ? step["event"].trim() : "";
    if (event) return event;
  }

  return null;
}

function parseSteps(value: unknown): { steps: unknown[]; triggerEvent: string } | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 150) {
    return null;
  }

  const triggerEvent = triggerEventFromSteps(value);
  if (!triggerEvent) return null;

  return { steps: value, triggerEvent };
}

export function parseCreateAutomationInput(value: unknown): {
  connections: unknown[];
  name: string;
  status: "enabled" | "disabled";
  steps: unknown[];
  triggerEvent: string;
} {
  if (!isRecord(value)) {
    throw new AutomationError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues: AutomationValidationIssue[] = [];
  for (const field of Object.keys(value)) {
    if (!["connections", "name", "status", "steps"].includes(field)) {
      issues.push(invalid(field, "This field is not supported."));
    }
  }

  const name = automationName(value.name);
  const status =
    value.status === undefined ? "disabled" : automationStatus(value.status);
  const connections = value.connections === undefined ? [] : value.connections;
  const parsed = parseSteps(value.steps);

  if (!name) {
    issues.push(
      invalid("name", "Enter a name of 1-120 characters without control characters."),
    );
  }
  if (!status) {
    issues.push(invalid("status", "Must be enabled or disabled."));
  }
  if (!Array.isArray(connections)) {
    issues.push(invalid("connections", "Use an array of step connections."));
  }
  if (!parsed) {
    issues.push(
      invalid(
        "steps",
        "Provide 1-150 steps including at least one trigger step with an event name.",
      ),
    );
  }
  if (issues.length > 0 || !name || !status || !parsed) {
    throw new AutomationError("VALIDATION_ERROR", issues);
  }

  return {
    connections: connections as unknown[],
    name,
    status,
    steps: parsed.steps,
    triggerEvent: parsed.triggerEvent,
  };
}

export function parseUpdateAutomationInput(value: unknown): {
  connections?: unknown[];
  name?: string;
  status?: "enabled" | "disabled";
  steps?: unknown[];
  triggerEvent?: string;
} {
  if (!isRecord(value)) {
    throw new AutomationError("VALIDATION_ERROR", [
      invalid("body", "Must be a JSON object."),
    ]);
  }

  const issues: AutomationValidationIssue[] = [];
  const result: {
    connections?: unknown[];
    name?: string;
    status?: "enabled" | "disabled";
    steps?: unknown[];
    triggerEvent?: string;
  } = {};

  if (Object.hasOwn(value, "name")) {
    const name = automationName(value.name);
    if (name) result.name = name;
    else {
      issues.push(
        invalid("name", "Enter a name of 1-120 characters without control characters."),
      );
    }
  }

  if (Object.hasOwn(value, "status")) {
    const status = automationStatus(value.status);
    if (status) result.status = status;
    else issues.push(invalid("status", "Must be enabled or disabled."));
  }

  if (Object.hasOwn(value, "connections")) {
    if (Array.isArray(value.connections)) result.connections = value.connections;
    else issues.push(invalid("connections", "Use an array of step connections."));
  }

  if (Object.hasOwn(value, "steps")) {
    const parsed = parseSteps(value.steps);
    if (parsed) {
      result.steps = parsed.steps;
      result.triggerEvent = parsed.triggerEvent;
    } else {
      issues.push(
        invalid(
          "steps",
          "Provide 1-150 steps including at least one trigger step with an event name.",
        ),
      );
    }
  }

  if (Object.keys(result).length === 0) {
    issues.push(invalid("body", "Provide name, status, steps, or connections to update."));
  }
  if (issues.length > 0) throw new AutomationError("VALIDATION_ERROR", issues);
  return result;
}
