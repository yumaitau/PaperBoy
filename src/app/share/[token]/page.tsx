import type { Metadata } from "next";
import { PaperboyLogo } from "@/components/brand/paperboy-logo";
import { MessageStatusError } from "@/lib/message-status-core";
import { getSharedEmail } from "@/lib/message-sharing";
import { templateBrowserPreviewDocument } from "@/lib/template-browser-preview";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Shared email · PaperBoy",
};

type Props = {
  params: Promise<{ token: string }>;
};

async function sharedEmail(token: string) {
  try {
    return await getSharedEmail({ token });
  } catch (error) {
    if (error instanceof MessageStatusError) return null;
    throw error;
  }
}

export default async function SharedEmailPage({ params }: Props) {
  const { token } = await params;
  const email = await sharedEmail(token);

  return (
    <main className="auth-shell">
      <section className="auth-card shared-email-card">
        <PaperboyLogo compact />
        {!email ? (
          <>
            <h1>Link unavailable</h1>
            <p className="form-error" role="alert">
              This shared email link is invalid or has expired. Ask the sender
              for a new link.
            </p>
          </>
        ) : (
          <>
            <h1>{email.subject}</h1>
            <dl className="shared-email-meta">
              <div><dt>From</dt><dd>{email.from}</dd></div>
              <div><dt>To</dt><dd>{email.to.join(", ")}</dd></div>
            </dl>
            {email.html ? (
              <iframe
                className="shared-email-frame"
                referrerPolicy="no-referrer"
                sandbox=""
                srcDoc={templateBrowserPreviewDocument(email.html)}
                title="Shared email content"
              />
            ) : (
              <pre className="shared-email-text">{email.text ?? ""}</pre>
            )}
          </>
        )}
      </section>
    </main>
  );
}
