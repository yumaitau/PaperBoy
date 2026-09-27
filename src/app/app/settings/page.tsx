import { updateTimeZoneAction } from "./actions";
import { DeviceTimeZone } from "./device-time-zone";
import { SecuritySettings } from "./security-settings";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/session";
import { configuredPasskeys } from "@/lib/passkey-configuration";
import { formatDateTime, timeZoneLabel } from "@/lib/time";

type SettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

const timeZones = ["UTC", ...Intl.supportedValuesOf("timeZone")].filter(
  (timeZone, index, values) => values.indexOf(timeZone) === index,
);

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const [session, status] = await Promise.all([
    requireSession(),
    searchParams,
  ]);
  const passkeys = configuredPasskeys();
  const enrolledPasskeys = await auth.api.listPasskeys({
    headers: await headers(),
  });

  return (
    <section>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Make the console read like your local clock.</p>

      <div className="card settings-card">
        <h2>Timezone</h2>
        <p>
          Console dates, logs, and scheduled work use this IANA timezone.
          Protocol timestamps and stored instants remain UTC.
        </p>

        {status.saved === "timezone" ? (
          <p className="form-success" role="status">
            Timezone saved.
          </p>
        ) : null}
        {status.error === "invalid-timezone" ? (
          <p className="form-error" role="alert">
            Choose a valid IANA timezone.
          </p>
        ) : null}

        <p className="field-help">
          Current time in <code>{session.user.timezone}</code>:{" "}
          <strong>{formatDateTime(new Date(), session.user.timezone)}</strong>
        </p>
        <DeviceTimeZone savedTimeZone={session.user.timezone} />

        <form action={updateTimeZoneAction} className="settings-form">
          <div className="field">
            <label htmlFor="timezone">IANA timezone</label>
            <select
              defaultValue={session.user.timezone}
              id="timezone"
              // Remount after a save so the dropdown shows the stored zone.
              key={session.user.timezone}
              name="timezone"
              required
            >
              {timeZones.map((timeZone) => (
                <option key={timeZone} value={timeZone}>
                  {timeZoneLabel(timeZone)}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" type="submit">
            Save timezone
          </button>
        </form>
      </div>

      <div className="card settings-card">
        <h2>Account security</h2>
        <SecuritySettings
          initialPasskeys={enrolledPasskeys}
          initialTwoFactorEnabled={session.user.twoFactorEnabled === true}
          passkeyOrigin={passkeys.origin}
          timeZone={session.user.timezone}
        />
      </div>
    </section>
  );
}
