import { attachmentDownloadResponse } from "@/lib/attachment-download";
import { MessageStatusError } from "@/lib/message-status-core";
import { downloadSharedAttachment } from "@/lib/message-sharing";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return Response.json(
      {
        error: {
          code: "not_found",
          message: "This download link is invalid or expired.",
        },
      },
      { headers: { "Cache-Control": "no-store" }, status: 404 },
    );
  }

  try {
    const attachment = await downloadSharedAttachment({ token });
    return attachmentDownloadResponse(attachment);
  } catch (error) {
    if (error instanceof MessageStatusError) {
      return Response.json(
        {
          error: {
            code: "not_found",
            message: "This download link is invalid or expired.",
          },
        },
        { headers: { "Cache-Control": "no-store" }, status: 404 },
      );
    }

    console.error("PaperBoy attachment download failed.");
    return Response.json(
      {
        error: {
          code: "attachment_storage_unavailable",
          message: "Attachment storage is unavailable.",
        },
      },
      { headers: { "Cache-Control": "no-store" }, status: 503 },
    );
  }
}
