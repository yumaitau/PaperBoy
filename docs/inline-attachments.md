# Inline attachment labels and MIME

An attachment's `content_id` is a logical label. Reference it with a `cid:` URL, for example `content_id: "café"` and `<img src="cid:caf%C3%A9">`. API responses, stored content and attachment metadata, and idempotency comparisons preserve the original label and HTML.

When composing MIME, PaperBoy converts labels containing non-ASCII characters into bounded ASCII message identifiers of the form `pb-<64 hex digits>@cid.paperboy.invalid`. Only matching CID URL references in the MIME HTML change with them. This avoids invalid encoded-word Content-ID headers and works with transports such as SES that do not support SMTPUTF8. Ordinary ASCII labels remain unchanged. Plain text bodies also remain unchanged.

The same conversion applies to SMTP, Cloudflare's actual SMTP delivery, SES raw MIME, and authorized owner MIME downloads. Owner downloads remain unsigned reconstructions of stored content, including owner-visible BCC; their HTML references bind to their attachment Content-IDs. Delivery MIME still omits BCC. Signing policy, attachment bytes, filenames, disposition, provider metadata and correlation headers are unchanged.

Cloudflare's structured compatibility payload keeps **original labels and original HTML together**. It is not the MIME transport. Neither representation mixes rewritten attachment IDs with original HTML.

## Matching references

Labels are case-sensitive and are not Unicode-normalized. The `cid:` scheme is case-insensitive. HTML entities in attributes, URL percent escapes (decoded once, as specified by RFC 2392), and CSS escapes in `url()` are understood. A plus sign is a literal plus. Percent-encode reserved URL characters in labels; also escape HTML quotes and ampersands when putting a URL inside an attribute.

Matching first applies URL input preprocessing: leading and trailing C0 controls and spaces are trimmed, and ASCII tabs, line feeds, and carriage returns are removed. Percent decoding happens afterward. These URL syntax rules do not change the stored attachment label or normalize its Unicode characters.

PaperBoy parses HTML and changes source spans for matching URL attributes, including image and media sources, links, backgrounds, SVG `href`/`xlink:href`, SVG presentation URLs, `img`/`source` `srcset`, and `link` `imagesrcset`. CSS `url()` references in style attributes and CSS style blocks are handled too. Unchanged source spans retain their original formatting. Changed attributes may be escaped again to retain their decoded meaning.

SVG style blocks use parsed text, including decoded HTML entities and CDATA contents. Only actual CSS URL tokens change; decoded CSS strings and comments remain untouched. CDATA delimiters and other unchanged source spans are preserved. HTML style blocks retain their raw-text entity semantics.

Ordinary prose, comments, scripts, unrelated attributes, unmatched URLs, invalid percent escapes, malformed CSS URL tokens, and invalid srcset candidates are left intact. Arbitrary text that resembles HTML or CSS is not treated as a reference. Use valid HTML/CSS and UTF-8 percent-encoded CID URLs for portable rendering.

Use well-formed Unicode labels without control characters. Literal NUL characters are replaced by HTML parsers, and unpaired UTF-16 surrogates cannot round-trip through UTF-8 storage, even where legacy input validation accepts them.

## Determinism and duplicate labels

Repeated uses of the same label receive the same wire ID. Duplicate attachment labels keep that shared identity; as with duplicate ASCII Content-IDs, a reference cannot distinguish which duplicate attachment to display. Use distinct labels for distinct images.

Wire IDs are deterministic for a given set of attachment labels, independent of attachment order. PaperBoy reserves all supplied ASCII IDs and resolves collisions before rewriting references. If a supplied ASCII ID occupies a generated ID, a deterministic alternative is used for the Unicode label. Adding or removing such a colliding attachment can therefore change that label's wire ID. Consumers should resolve the IDs in the MIME they receive, rather than calculate or persist wire IDs themselves.
