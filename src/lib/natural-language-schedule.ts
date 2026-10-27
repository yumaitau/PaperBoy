import * as chrono from "chrono-node";
import { formatLocalDateTime, normalizeTimeZone, parseLocalDateTime } from "@/lib/time";

export type NaturalLanguageScheduleResult =
  | { date: Date; error: null; label: string }
  | { date: null; error: string; label: null };

const WEEKDAY_PATTERN =
  /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;

export function formatNaturalLanguageSchedule(
  value: Date | string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    timeZone: normalizeTimeZone(timeZone),
    timeZoneName: "short",
    weekday: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function naturalLanguageScheduleInput(
  value: Date | string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    timeZone: normalizeTimeZone(timeZone),
    weekday: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function parseNaturalLanguageSchedule(
  value: unknown,
  reference: Date,
  timeZone: string,
): NaturalLanguageScheduleResult {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 200) {
    return {
      date: null,
      error: "Type one future date and time.",
      label: null,
    };
  }

  const zone = normalizeTimeZone(timeZone);
  // Chrono accepts numeric offsets and abbreviations, not IANA zone names.
  // Anchor relative dates to the user's calendar at the reference instant.
  const referenceOffset = (
    Date.parse(`${formatLocalDateTime(reference, zone)}:00Z`) -
    Math.floor(reference.getTime() / 60_000) * 60_000
  ) / 60_000;
  const results = chrono.en.GB.parse(
    text,
    { instant: reference, timezone: referenceOffset },
    { forwardDate: true },
  );
  if (results.length !== 1) {
    return {
      date: null,
      error: "Type one unambiguous future date and time.",
      label: null,
    };
  }

  const result = results[0];
  if (!result.start.isCertain("day") || !result.start.isCertain("hour")) {
    return {
      date: null,
      error: "Include both a day and time.",
      label: null,
    };
  }

  const localParts = {
    day: result.start.get("day"),
    hour: result.start.get("hour"),
    minute: result.start.get("minute") ?? 0,
    month: result.start.get("month"),
    year: result.start.get("year"),
  };
  if (
    localParts.year === null ||
    localParts.month === null ||
    localParts.day === null ||
    localParts.hour === null
  ) {
    return {
      date: null,
      error: "Type one unambiguous future date and time.",
      label: null,
    };
  }
  const date = result.start.isCertain("timezoneOffset")
    ? result.start.date()
    : parseLocalDateTime(
        [
          String(localParts.year).padStart(4, "0"),
          String(localParts.month).padStart(2, "0"),
          String(localParts.day).padStart(2, "0"),
        ].join("-") +
          `T${String(localParts.hour).padStart(2, "0")}:${String(localParts.minute).padStart(2, "0")}`,
        zone,
      );
  if (!date) {
    return {
      date: null,
      error: "That local time does not exist in this timezone.",
      label: null,
    };
  }
  if (date <= reference) {
    return {
      date: null,
      error: "Choose a future date and time.",
      label: null,
    };
  }

  const requestedWeekday = WEEKDAY_PATTERN.exec(text)?.[1];
  if (requestedWeekday) {
    // Validate the weekday in the calendar the user typed, before converting
    // an explicit offset to their display timezone (which can change the day).
    const calendarDate = new Date(
      Date.UTC(localParts.year, localParts.month - 1, localParts.day),
    );
    const actualWeekday = new Intl.DateTimeFormat("en-AU", {
      timeZone: "UTC",
      weekday: "long",
    }).format(calendarDate);
    if (requestedWeekday.toLowerCase() !== actualWeekday.toLowerCase()) {
      const calendarLabel = new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
        year: "numeric",
      }).format(calendarDate);
      return {
        date: null,
        error: `${calendarLabel} is ${actualWeekday}, not ${requestedWeekday}.`,
        label: null,
      };
    }
  }

  return {
    date,
    error: null,
    label: formatNaturalLanguageSchedule(date, zone),
  };
}
