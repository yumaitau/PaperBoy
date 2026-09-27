-- Deletion moved behind dedicated *.delete permissions. Scoped API keys that
-- could delete through a manage/control scope keep that ability.
UPDATE "api_keys"
SET "scopes" = (
  SELECT array_agg(DISTINCT scope ORDER BY scope)
  FROM unnest(
    "scopes" || ARRAY(
      SELECT mapping.delete_scope
      FROM (VALUES
        ('audiences.manage', 'audiences.delete'),
        ('automations.manage', 'automations.delete'),
        ('broadcasts.control', 'broadcasts.delete'),
        ('contactProperties.manage', 'contactProperties.delete'),
        ('events.manage', 'events.delete'),
        ('segments.manage', 'segments.delete'),
        ('suppressions.manage', 'suppressions.delete'),
        ('topics.manage', 'topics.delete'),
        ('webhooks.manage', 'webhooks.delete')
      ) AS mapping(manage_scope, delete_scope)
      WHERE mapping.manage_scope = ANY("scopes")
    )
  ) AS scope
)
-- Only keys holding a mapped scope change, so array_agg never sees an empty set
-- (a NULL scopes array would mean an unscoped, full-access key).
WHERE "scopes" && ARRAY[
  'audiences.manage', 'automations.manage', 'broadcasts.control',
  'contactProperties.manage', 'events.manage', 'segments.manage',
  'suppressions.manage', 'topics.manage', 'webhooks.manage'
]::text[];
