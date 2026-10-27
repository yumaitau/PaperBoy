# Scheduled-email idempotency rollout

New email request hashes include the `paperboy:email-request:v2` domain prefix
followed by a NUL byte before the canonical JSON. The stored digest remains a
64-character lowercase SHA-256 hex string; no database migration is required.
Every new key retains its requested schedule in its identity, even when delivery
uses the 60-second grace window to send immediately.

Exact unversioned hashes remain replayable. Older writers discarded near/past
schedule instants before hashing, so their exact original instant cannot be
recovered. An optional compatibility fallback restores a bounded part of that
old equivalence class: all other request fields must match, and the requested
schedule must be no later than the original row's `created_at` plus 60 seconds.
The boundary uses the original creation time, never the retry time. Creation
time approximates the old parse time; it does not prove the original instant.

## Enabling legacy near/past retries

Set `PAPERBOY_LEGACY_IDEMPOTENCY_BEFORE` only to a verified cutover instant before
which all stored hashes used the old schedule-normalizing writer. Use canonical
UTC ISO format with milliseconds, for example `2026-10-27T00:00:00.000Z`.
Only rows created **strictly before** that instant can use the relaxed fallback.
Missing or malformed configuration disables the fallback; exact replay remains
available and incompatible retries return HTTP 409.

PR #72 introduced stable schedule identity with unversioned hashes. Its
unscheduled hashes are indistinguishable from older null-schedule hashes. If
that version ran, the cutoff must be no later than its first possible write.
Do not infer provenance from `scheduled_at IS NULL`, a merge timestamp, or the
first v2 deployment. If deployment history cannot establish a trustworthy
cutoff, leave the setting unset. If #72 never ran, a verified stop time for all
old writers before starting v2 writers provides a conservative cutoff.

Do not use a rolling or future cutoff. The configured cutoff must continue to
exclude every potentially ambiguous #72 write. Legacy records after the cutoff
remain eligible for exact replay only.
Remove this compatibility setting after 24 hours have elapsed since the last
legacy writer stopped; the active-key window is 24 hours from original creation.
Never switch to a fresh idempotency key just to bypass a replay conflict, since
that can send the same email again.

## Traffic cutover and rollback

Old instances cannot read v2 hashes: an identical retry of a v2 key sent to an
old instance returns HTTP 409, including unscheduled requests. The legacy cutoff
cannot fix this. Before v2 writes begin, stop routing send/API traffic to old
instances and drain their in-flight sends, including MCP callers, then enable
traffic on v2 instances. Avoid a rolling deployment that sends retries to both
old and v2 readers. A reader-first rollout is another option only with a separate
release that teaches every serving instance to read v2 before enabling v2 writes;
this patch starts writing v2 immediately.

For rollback, retain v2-capable readers until 24 hours after the last v2 write.
Rolling back sooner to an old reader causes 409 responses for still-active v2
keys; accept that limitation explicitly if an emergency requires it. Keep the
original idempotency keys when retrying. This v2 drain window is separate from
the legacy fallback's retirement window above.

Replays retain the original ID, hash, creation time, schedule, and events, do not
extend the key lifetime, and do not enqueue another message. Permission and
recipient-suppression checks still apply. The same comparison handles both an
existing-key lookup and recovery after a concurrent unique-key collision.
