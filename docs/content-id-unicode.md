# CID Unicode input validation

Attachment `content_id` labels must be well-formed Unicode. A lone high or low
UTF-16 surrogate (including escaped JSON such as `"\ud800"`) now produces the
existing field validation error, HTTP 422, before queueing or attachment storage.
MCP rejects the same values in both inline and template sends before invoking the
queue service. This prevents distinct inputs from being silently converted to
U+FFFD by UTF-8 persistence. Existing records are not rewritten.

Valid surrogate pairs, emoji, combining marks, and the literal U+FFFD character
remain accepted within the existing length and character restrictions. Labels
retain their exact identity: no Unicode normalization or replacement occurs.
For example, `é` and `e` followed by U+0301 remain distinct labels.

The OpenAPI and MCP patterns express the rule for ECMAScript regex engines with
or without Unicode mode. JSON Schema implementations that refuse lone surrogates
during JSON decoding may reject earlier. PHP strings contain bytes rather than
UTF-16 code units: PHP JSON decoding rejects escaped lone surrogates, and the
generated model's UTF-8 PCRE check rejects malformed UTF-8 bytes, including encoded
surrogates and CESU-8. Its existing ECMAScript whitespace and absolute-anchor
repair remains part of SDK generation. PHP does not have a valid UTF-8 encoding
for a lone surrogate, so this is not a claim of identical transport behavior.

The generated TypeScript SDK exposes a string type and this documented contract;
it does not perform client-side runtime validation. The server enforces the rule.
This change does not change CID length limits, MIME composition, inbound MIME
parsing, or the separate policy for ASCII controls.
