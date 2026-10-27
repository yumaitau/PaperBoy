# Content-ID storage and PostgreSQL locales

The `message_attachments` and `received_email_attachments` CID checks use the
`C` collation explicitly. In that collation, PostgreSQL `[[:space:]]` means
U+0009–U+000D (tab, LF, vertical tab, form feed, CR) and U+0020 (space).
Both checks also reject `<`, `>`, and `,`, and require either NULL or 1–256
PostgreSQL characters. They do not normalize or rewrite labels.

Previously the same regex used the column/database collation. PostgreSQL 17
with ICU `en-US` treats U+0085 (NEL, UTF-8 `c285`) as whitespace, while the
`C` collation and macOS libc `en_US.UTF-8` do not. JavaScript `\s` does not
include NEL. A valid outgoing label could therefore pass input validation
and fail with SQLSTATE 23514 during queue storage, depending on the server.
Inbound attachment storage used the same check and had the same defect.

## Storage and input contracts

The database checks are legacy storage safeguards, not a copy of the outgoing
API validator. Outgoing validation rejects JavaScript whitespace and
semicolons separately. Inbound parsing uses mailparser's trimmed, bracket-free
`cid`: `Content-ID: <logo@example.com>` is stored and returned as
`logo@example.com`. It retains at most 256 UTF-16 code units without splitting
a surrogate pair. Missing or empty IDs, or IDs containing NUL, ASCII
whitespace, remaining angle brackets, or commas, become NULL; the message and
attachment are still retained. Validation happens before truncation.

Inbound parsing does not apply outgoing validation. For example, an inbound
semicolon or internal non-ASCII whitespace retains the behavior already
supported by a C-locale database. The received API exposes the stored incoming
MIME ID, which can differ from a sender's original logical label. Sent APIs
continue to expose the original label. Migration 0043 itself left both parsers
unchanged; the received parser now aligns with its existing storage checks.

Do not replace the storage regex with JavaScript's full whitespace set, or
add outbound-only restrictions to it without a separate data migration plan.
Existing C-locale databases can contain non-ASCII spaces, semicolons, and
non-whitespace controls. Tightening either check would fail validation of
those rows or change the inbound contract. NUL and malformed encodings are
already rejected by PostgreSQL text/encoding handling; Unicode CID transport
requires a UTF-8 database. The existing character-length check is unchanged.

## Migration 0043

Migration 0043 replaces both checks, with matching Drizzle schema and snapshot.
It removes only locale-dependent restrictions: the six ASCII whitespace
characters and three delimiters were forbidden in the supported old locales
and remain forbidden. NULL and length semantics are unchanged. No rows are
deleted or rewritten, and the new checks remain fully validated.

The normal Drizzle migrator runs this DDL in a transaction. PostgreSQL acquires
table locks and scans existing rows when adding the checks, so schedule it
appropriately for large attachment tables. A failed migration rolls back the
constraint changes. After new labels have been stored, reverting to the old
locale-dependent checks can fail on affected locales; prefer a forward fix.

Regression tests exercise queue/reconstruction, inbound parsed labels, and the
actual migration on empty and populated temporary tables under `C`, the
database default, and an ICU collation when available. Legacy fixtures include
the full JavaScript non-ASCII whitespace set and supplementary characters.
