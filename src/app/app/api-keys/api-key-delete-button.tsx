"use client";

import { deleteApiKeyAction } from "./actions";

export function DeleteApiKeyForm({
  apiKeyId,
  keyName,
}: {
  apiKeyId: string;
  keyName: string;
}) {
  return (
    <form
      action={deleteApiKeyAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Permanently delete "${keyName}"? Its audit history is kept, but the key cannot be restored.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="apiKeyId" type="hidden" value={apiKeyId} />
      <button className="btn btn-compact" type="submit">
        Delete
      </button>
    </form>
  );
}
