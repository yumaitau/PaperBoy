import type { Email, PaperBoyMessageStatus } from "../../packages/sdk/src/index";
import type { MessageStatus } from "../../src/lib/email-core";

// Both directions must compile so API status additions cannot silently leave
// the SDK narrower (or wider) than the server's actual response contract.
export function toSdkStatus(status: MessageStatus): PaperBoyMessageStatus {
  return status;
}

export function toApiStatus(status: PaperBoyMessageStatus): MessageStatus {
  return status;
}

export function isCancelled(email: Email): boolean {
  return email.status === "cancelled";
}
