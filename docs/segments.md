# Segments, topics, and contacts

PaperBoy keeps Resend's deprecated audiences working while adding the current
Resend-shaped surface: segments, topics, contact properties, top-level
contacts, and contact imports.

## Model

- Audiences still own their contacts through `/api/v1/audiences`. Nothing
  about that path changed.
- Segments are named org-level lists. Topics carry an immutable
  `default_subscription` (`opt_in` or `opt_out`), an optional description,
  and `public` or `private` visibility.
- Contact properties define typed (`string` or `number`) custom attribute
  keys. Contact rows keep their own `properties` map.
- Top-level contacts are org-scoped rows with no audience. They carry
  `email`, `first_name`, `last_name`, `properties`, and an `unsubscribed`
  flag, plus segment and topic membership. Look them up by UUID or email;
  email lookup prefers the org-level row.
- Contact imports record every CSV run with `queued`, `in_progress`,
  `completed`, or `failed` status plus created, updated, and skipped counts.

## REST

- `GET`/`POST /api/v1/segments`, `GET`/`PATCH`/`DELETE
  /api/v1/segments/{segmentId}`
- `GET`/`POST /api/v1/topics`, `GET`/`PATCH`/`DELETE
  /api/v1/topics/{topicId}`
- `GET`/`POST /api/v1/contact-properties`, `GET`/`PATCH`/`DELETE
  /api/v1/contact-properties/{propertyId}`
- `GET`/`POST /api/v1/contacts` with optional `segment_id` and `limit`
  query parameters
- `GET`/`PATCH`/`DELETE /api/v1/contacts/{contactId}` where the ID is a
  UUID or a URI-encoded email address
- `GET /api/v1/contacts/{contactId}/segments`,
  `POST`/`DELETE /api/v1/contacts/{contactId}/segments/{segmentId}`
- `GET`/`PATCH /api/v1/contacts/{contactId}/topics` with a bulk
  `{topics: [{id, subscription}]}` body
- `GET`/`POST /api/v1/contacts/imports`,
  `GET /api/v1/contacts/imports/{importId}`. POST accepts JSON
  `{csv, column_map, on_conflict, segments, topics, file_name}` or
  `multipart/form-data` with a `file` field. Imports run synchronously and
  the outcome is stored on the import record.

## MCP

`paperboy_list/create/get/update/delete_segment`,
`paperboy_list/create/get/update/delete_topic`,
`paperboy_list/create/get/update/delete_contact_property`,
`paperboy_list_org_contacts`, `paperboy_create_org_contact`,
`paperboy_get_org_contact`, `paperboy_update_org_contact`,
`paperboy_delete_org_contact`, segment and topic membership tools, and
`paperboy_create/list/get_contact_import`.

## Permissions

Segment and topic operations need `segments.*` and `topics.*`; property
operations need `contactProperties.*`; contact and import operations reuse
`audiences.read` and `audiences.manage`. API key scopes are enforced on top
of the creator role for every route and tool.
