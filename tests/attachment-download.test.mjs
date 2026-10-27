import assert from "node:assert/strict";
import test from "node:test";
import { attachmentDownloadResponse } from "../src/lib/attachment-download.ts";

for (const filename of ["report.txt", "文件.txt", "résumé 📄.pdf", "100% ('draft')*.txt", 'quoted"back\\slash.txt', "bad\r\nInjected: x\u0000.txt", "\ud800.txt", ""]) {
  test(`attachment download encodes ${JSON.stringify(filename)} safely`, async () => {
    const bytes = new TextEncoder().encode("attachment bytes");
    const response = attachmentDownloadResponse({ bytes, contentType: "application/octet-stream", filename });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "attachment bytes");
    assert.equal(response.headers.get("Content-Type"), "application/octet-stream");
    assert.equal(response.headers.get("Cache-Control"), "private, max-age=3600");
    const disposition = response.headers.get("Content-Disposition");
    assert.match(disposition, /^attachment; filename="[\x20-\x21\x23-\x5b\x5d-\x7e]+"; filename\*=UTF-8''[A-Za-z0-9!#$&+.^_`|~%\-]+$/);
    assert.equal(
      decodeURIComponent(disposition.split("filename*=UTF-8''")[1]),
      filename.toWellFormed().replace(/[\u0000-\u001f\u007f]/g, "") || "attachment",
    );
  });
}

test("ASCII downloads retain a readable fallback name", () => {
  const response = attachmentDownloadResponse({ bytes: new Uint8Array(), contentType: "text/plain", filename: "report.txt" });
  assert.equal(response.headers.get("Content-Disposition"), "attachment; filename=\"report.txt\"; filename*=UTF-8''report.txt");
});
