/** Build a download response with an ASCII header and an RFC 8187 UTF-8 name. */
export function attachmentDownloadResponse(attachment: {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}): Response {
  const filename = attachment.filename.toWellFormed().replace(/[\u0000-\u001f\u007f]/g, "") || "attachment";
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return new Response(new Uint8Array(attachment.bytes), {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
      "Content-Type": attachment.contentType,
    },
    status: 200,
  });
}
