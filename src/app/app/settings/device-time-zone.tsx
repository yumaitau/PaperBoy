"use client";

import { useSyncExternalStore } from "react";
import { updateTimeZoneAction } from "./actions";
import { canonicalTimeZone } from "@/lib/time";

const subscribe = () => () => {};
// Unlike browserTimeZone(), no Sydney fallback: an unknown zone suggests nothing.
const deviceSnapshot = () =>
  canonicalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

export function DeviceTimeZone({ savedTimeZone }: { savedTimeZone: string }) {
  // Server render has no device zone; the browser fills it in after hydration.
  const deviceTimeZone = useSyncExternalStore(subscribe, deviceSnapshot, () => null);

  // The server may store another spelling of the same zone (Asia/Calcutta vs
  // Asia/Kolkata), so compare in this browser's spelling.
  if (!deviceTimeZone || deviceTimeZone === canonicalTimeZone(savedTimeZone)) return null;

  return (
    <form action={updateTimeZoneAction} className="device-time-zone">
      <input name="timezone" type="hidden" value={deviceTimeZone} />
      <p>
        This device uses <code>{deviceTimeZone}</code>.
      </p>
      <button className="btn btn-compact" type="submit">
        Use {deviceTimeZone}
      </button>
    </form>
  );
}
