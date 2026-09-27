-- Throwaway-database rollback: drop the backfilled delete scopes.
UPDATE "api_keys"
SET "scopes" = ARRAY(
  SELECT scope FROM unnest("scopes") AS scope
  WHERE scope NOT IN (
    'automations.delete', 'broadcasts.delete', 'contactProperties.delete',
    'events.delete', 'segments.delete', 'topics.delete', 'webhooks.delete'
  )
)
WHERE "scopes" IS NOT NULL;
