export const DEFAULT_TIME_ZONE = "Australia/Sydney";

const calendarFormatters = new Map<string, Intl.DateTimeFormat>();
const localDateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const canonicalTimeZones = new Set([
  ...Intl.supportedValuesOf("timeZone"),
  "UTC",
]);

// IANA renames as [current, former]. Runtimes disagree on which spelling they
// list and report: JavaScriptCore (Bun, Safari) lists former names and returns
// input unchanged, while SpiderMonkey reports current names. Map either to the
// spelling this runtime lists so a browser's zone is never rejected.
const timeZoneRenames: ReadonlyArray<readonly [string, string]> = [
  ["America/Argentina/Buenos_Aires", "America/Buenos_Aires"],
  ["America/Argentina/Catamarca", "America/Catamarca"],
  ["America/Argentina/Cordoba", "America/Cordoba"],
  ["America/Argentina/Jujuy", "America/Jujuy"],
  ["America/Argentina/Mendoza", "America/Mendoza"],
  ["America/Atikokan", "America/Coral_Harbour"],
  ["America/Indiana/Indianapolis", "America/Indianapolis"],
  ["America/Kentucky/Louisville", "America/Louisville"],
  ["America/Nuuk", "America/Godthab"],
  ["Asia/Dhaka", "Asia/Dacca"],
  ["Asia/Ho_Chi_Minh", "Asia/Saigon"],
  ["Asia/Kathmandu", "Asia/Katmandu"],
  ["Asia/Kolkata", "Asia/Calcutta"],
  ["Asia/Macau", "Asia/Macao"],
  ["Asia/Makassar", "Asia/Ujung_Pandang"],
  ["Asia/Thimphu", "Asia/Thimbu"],
  ["Asia/Ulaanbaatar", "Asia/Ulan_Bator"],
  ["Asia/Yangon", "Asia/Rangoon"],
  ["Atlantic/Faroe", "Atlantic/Faeroe"],
  ["Europe/Kyiv", "Europe/Kiev"],
  ["Pacific/Chuuk", "Pacific/Truk"],
  ["Pacific/Kanton", "Pacific/Enderbury"],
  ["Pacific/Pohnpei", "Pacific/Ponape"],
];
const utcAliases = ["Etc/GMT", "Etc/UCT", "Etc/Universal", "Etc/UTC", "Etc/Zulu", "GMT", "UCT", "Universal", "Zulu"];
const timeZoneAliases = new Map<string, string>(utcAliases.map((alias) => [alias, "UTC"]));
for (const [current, former] of timeZoneRenames) {
  if (canonicalTimeZones.has(current)) timeZoneAliases.set(former, current);
  else if (canonicalTimeZones.has(former)) timeZoneAliases.set(current, former);
}

export function canonicalTimeZone(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 100 ||
    !/^[A-Za-z0-9_+\-/]+$/.test(value)
  ) {
    return null;
  }

  const listed = canonicalTimeZones.has(value) ? value : timeZoneAliases.get(value);
  if (!listed) return null;

  try {
    return new Intl.DateTimeFormat("en-AU", { timeZone: listed }).resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
}

// Label listed former spellings with the current name, e.g. "Asia/Kolkata
// (Asia/Calcutta)", so people find their city in pickers.
export function timeZoneLabel(timeZone: string): string {
  const rename = timeZoneRenames.find(([, former]) => former === timeZone);
  return rename ? `${rename[0]} (${timeZone})` : timeZone;
}

export function normalizeTimeZone(value: unknown): string {
  return canonicalTimeZone(value) ?? DEFAULT_TIME_ZONE;
}

export function browserTimeZone(): string {
  return normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

function calendarDateParts(value: unknown): {
  day: number;
  month: number;
  year: number;
} | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { day, month, year };
}

function calendarDateString(value: Date, timeZone: string): string {
  let formatter = calendarFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      calendar: "iso8601",
      day: "2-digit",
      month: "2-digit",
      numberingSystem: "latn",
      timeZone,
      year: "numeric",
    });
    calendarFormatters.set(timeZone, formatter);
  }
  const values = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function startOfCalendarDate(
  value: unknown,
  timeZone: unknown,
): Date | null {
  const parts = calendarDateParts(value);
  const zone = canonicalTimeZone(timeZone);
  if (!parts || !zone || typeof value !== "string") return null;

  const approximate = Date.UTC(parts.year, parts.month - 1, parts.day);
  let lower = approximate - 48 * 60 * 60 * 1_000;
  let upper = approximate + 48 * 60 * 60 * 1_000;
  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    if (calendarDateString(new Date(middle), zone) < value) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }

  const boundary = new Date(lower);
  return calendarDateString(boundary, zone) === value ? boundary : null;
}

export function startOfNextCalendarDate(
  value: unknown,
  timeZone: unknown,
): Date | null {
  const parts = calendarDateParts(value);
  if (!parts) return null;
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const nextValue = [
    String(next.getUTCFullYear()).padStart(4, "0"),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return startOfCalendarDate(nextValue, timeZone);
}

export function formatDateTime(
  value: Date | number | string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: normalizeTimeZone(timeZone),
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function protocolTimestamp(value: Date | number | string): string {
  return new Date(value).toISOString();
}

type LocalDateTimeParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  year: number;
};

function localDateTimeParts(value: unknown): LocalDateTimeParts | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const parts = {
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
  const check = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );
  return check.getUTCFullYear() === parts.year &&
    check.getUTCMonth() === parts.month - 1 &&
    check.getUTCDate() === parts.day &&
    check.getUTCHours() === parts.hour &&
    check.getUTCMinutes() === parts.minute
    ? parts
    : null;
}

function localDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = localDateTimeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      calendar: "iso8601",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      numberingSystem: "latn",
      timeZone,
      year: "numeric",
    });
    localDateTimeFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function formattedLocalParts(value: Date, timeZone: string): LocalDateTimeParts {
  const values = Object.fromEntries(
    localDateTimeFormatter(timeZone)
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    month: values.month,
    year: values.year,
  };
}

function sameLocalDateTime(
  left: LocalDateTimeParts,
  right: LocalDateTimeParts,
): boolean {
  return left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute;
}

export function parseLocalDateTime(
  value: unknown,
  timeZone: unknown,
): Date | null {
  const parts = localDateTimeParts(value);
  const zone = canonicalTimeZone(timeZone);
  if (!parts || !zone) return null;
  const localUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  const matches: Date[] = [];

  for (
    let offsetMinutes = -14 * 60;
    offsetMinutes <= 14 * 60;
    offsetMinutes += 15
  ) {
    const candidate = new Date(localUtc - offsetMinutes * 60_000);
    if (sameLocalDateTime(formattedLocalParts(candidate, zone), parts)) {
      matches.push(candidate);
    }
  }

  return matches.length === 1 ? matches[0] : null;
}

export function formatLocalDateTime(
  value: Date | number | string,
  timeZone: string,
): string {
  const parts = formattedLocalParts(new Date(value), normalizeTimeZone(timeZone));
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}
