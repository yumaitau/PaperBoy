/** Real MIME inputs and the received-storage contract, including legacy labels. */
export const receivedCidCases = [
  { name: "bracketed", header: "<logo@example.com>", expected: "logo@example.com" },
  { name: "bare", header: "logo@example.com", expected: "logo@example.com" },
  { name: "padded", header: "  < logo@example.com >  ", expected: "logo@example.com" },
  { name: "missing closing bracket", header: "<logo@example.com", expected: "logo@example.com" },
  { name: "missing opening bracket", header: "logo@example.com>", expected: "logo@example.com" },
  { name: "absent", header: null, expected: null },
  { name: "blank", header: " \t ", expected: null },
  { name: "empty brackets", header: "<>", expected: null },
  { name: "nested brackets", header: "<<logo@example.com>>", expected: null },
  { name: "internal bracket", header: "<lo<go@example.com>", expected: null },
  { name: "comma", header: "a,b@example.com", expected: null },
  ...[" ", "\t", "\v", "\f", "\r\n ", "\0"].map((character, i) => ({
    name: `unusable character ${i}`, header: `lo${character}go@example.com`, expected: null,
  })),
  // Inbound storage intentionally accepts these; outbound validation is stricter.
  ...[";", "\u0001", "\u007f", "\u0085", "\u00a0", "\u2003"].map((character, i) => ({
    name: `legacy character ${i}`, header: `<lo${character}go@example.com>`, expected: `lo${character}go@example.com`,
  })),
  { name: "unicode", header: "<café/画像/📨>", expected: "café/画像/📨" },
  { name: "decomposed", header: "<cafe\u0301>", expected: "cafe\u0301" },
  { name: "maximum ASCII", header: `<${"a".repeat(256)}>`, expected: "a".repeat(256) },
  { name: "long ASCII", header: `<${"a".repeat(300)}>`, expected: "a".repeat(256) },
  { name: "maximum astral", header: `<${"📨".repeat(128)}>`, expected: "📨".repeat(128) },
  { name: "long astral", header: `<${"📨".repeat(129)}>`, expected: "📨".repeat(128) },
  { name: "split astral", header: `${"a".repeat(255)}📨`, expected: "a".repeat(255) },
  { name: "invalid beyond limit", header: `${"a".repeat(256)},`, expected: null },
];

/** Keep the HTML CID reference and attachment bytes intact through ingestion. */
export function receivedCidMime({ name, header }) {
  return [
    "From: sender@example.org", "To: reader@example.net", `Subject: CID ${name}`,
    "MIME-Version: 1.0", 'Content-Type: multipart/related; boundary="cid-test"', "",
    "--cid-test", "Content-Type: text/html; charset=utf-8", "",
    '<p>Image</p><img src="cid:logo@example.com">', "--cid-test",
    'Content-Type: image/png; name="logo.png"', "Content-Transfer-Encoding: base64",
    'Content-Disposition: inline; filename="logo.png"',
    ...(header === null ? [] : [`Content-ID: ${header}`]),
    "", "aW1hZ2U=", "--cid-test--", "",
  ].join("\r\n");
}
