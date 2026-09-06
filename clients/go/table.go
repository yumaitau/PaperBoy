package main

// Action describes one CLI invocation mapped onto an HTTP operation.
type Action struct {
	Name   string
	Desc   string
	Method string
	Path   string
	// Slots names the positional arguments that fill {placeholders}, in order.
	Slots []string
	// HasBody allows --set/--json request bodies.
	HasBody bool
	// HasQuery allows --query parameters.
	HasQuery bool
	// Upload, when non-empty, sends a file: "raw:<mime>" posts raw bytes,
	// "form:<field>" posts multipart with --set entries as form fields.
	Upload string
}

// Resource groups related actions.
type Resource struct {
	Name    string
	Desc    string
	Actions []Action
}

// A builds an action; call .Body(), .Query(), or .File(f) to opt into inputs.
func A(name, desc, method, path string, slots ...string) Action {
	return Action{Name: name, Desc: desc, Method: method, Path: path, Slots: slots}
}

// Body marks the action as accepting --set/--json.
func (a Action) Body() Action { a.HasBody = true; return a }

// Query marks the action as accepting --query.
func (a Action) Query() Action { a.HasQuery = true; return a }

// File marks the action as a multipart upload with the file under field.
func (a Action) File(field string) Action { a.Upload = field; return a }

// Resources is the full CLI surface. Every entry must correspond to an
// operation in the repository openapi.yaml (verified by table_test.go).
func Resources() []Resource {
	return []Resource{
		{
			Name: "emails", Desc: "Queue and inspect transactional email",
			Actions: []Action{
				A("list", "List emails", "GET", "/api/v1/emails").Query(),
				A("send", "Queue one email", "POST", "/api/v1/emails").Body(),
				A("get", "Get one email", "GET", "/api/v1/emails/{emailId}", "email-id"),
				A("reschedule", "Reschedule a queued email", "PATCH", "/api/v1/emails/{emailId}", "email-id").Body(),
				A("cancel", "Cancel a queued email", "POST", "/api/v1/emails/{emailId}/cancel", "email-id"),
				A("events", "List one email's events", "GET", "/api/v1/emails/{emailId}/events", "email-id"),
				A("share", "Create an expiring share link", "POST", "/api/v1/emails/{emailId}/share", "email-id").Body(),
				A("attachments", "List one email's attachments", "GET", "/api/v1/emails/{emailId}/attachments", "email-id"),
				A("attachment", "Get one email attachment", "GET", "/api/v1/emails/{emailId}/attachments/{attachmentId}", "email-id", "attachment-id"),
				A("metrics", "Aggregate email metrics", "GET", "/api/v1/emails/metrics").Query(),
				A("send-batch", "Queue up to 100 emails from a JSON array (--body-file)", "POST", "/api/v1/emails/batch").Body(),
			},
		},
		{
			Name: "templates", Desc: "Manage email templates",
			Actions: []Action{
				A("list", "List templates", "GET", "/api/v1/templates"),
				A("create", "Create one template", "POST", "/api/v1/templates").Body(),
				A("get", "Get one template", "GET", "/api/v1/templates/{templateId}", "template-id"),
				A("update", "Update one template", "PATCH", "/api/v1/templates/{templateId}", "template-id").Body(),
				A("delete", "Delete one template", "DELETE", "/api/v1/templates/{templateId}", "template-id"),
				A("preview", "Render one template without sending", "POST", "/api/v1/templates/{templateId}/preview", "template-id").Body(),
				A("publish", "Publish one template", "POST", "/api/v1/templates/{templateId}/publish", "template-id"),
				A("duplicate", "Duplicate one template as a draft", "POST", "/api/v1/templates/{templateId}/duplicate", "template-id"),
			},
		},
		{
			Name: "audiences", Desc: "Manage audiences (legacy lists)",
			Actions: []Action{
				A("list", "List audiences", "GET", "/api/v1/audiences"),
				A("create", "Create one audience", "POST", "/api/v1/audiences").Body(),
				A("get", "Get one audience", "GET", "/api/v1/audiences/{audienceId}", "audience-id"),
				A("update", "Update one audience", "PATCH", "/api/v1/audiences/{audienceId}", "audience-id").Body(),
				A("delete", "Delete one audience", "DELETE", "/api/v1/audiences/{audienceId}", "audience-id"),
			},
		},
		{
			Name: "audience-contacts", Desc: "Manage contacts inside an audience",
			Actions: []Action{
				A("list", "List audience contacts", "GET", "/api/v1/audiences/{audienceId}/contacts", "audience-id"),
				A("create", "Create one audience contact", "POST", "/api/v1/audiences/{audienceId}/contacts", "audience-id").Body(),
				A("get", "Get one audience contact", "GET", "/api/v1/audiences/{audienceId}/contacts/{contactId}", "audience-id", "contact-id"),
				A("update", "Update one audience contact", "PATCH", "/api/v1/audiences/{audienceId}/contacts/{contactId}", "audience-id", "contact-id").Body(),
				A("delete", "Delete one audience contact", "DELETE", "/api/v1/audiences/{audienceId}/contacts/{contactId}", "audience-id", "contact-id"),
				A("import", "Import audience contacts from a CSV file", "POST", "/api/v1/audiences/{audienceId}/contacts/import", "audience-id").File("raw:text/csv"),
			},
		},
		{
			Name: "segments", Desc: "Manage segments",
			Actions: []Action{
				A("list", "List segments", "GET", "/api/v1/segments"),
				A("create", "Create one segment", "POST", "/api/v1/segments").Body(),
				A("get", "Get one segment", "GET", "/api/v1/segments/{segmentId}", "segment-id"),
				A("update", "Update one segment", "PATCH", "/api/v1/segments/{segmentId}", "segment-id").Body(),
				A("delete", "Delete one segment", "DELETE", "/api/v1/segments/{segmentId}", "segment-id"),
			},
		},
		{
			Name: "topics", Desc: "Manage topics",
			Actions: []Action{
				A("list", "List topics", "GET", "/api/v1/topics"),
				A("create", "Create one topic", "POST", "/api/v1/topics").Body(),
				A("get", "Get one topic", "GET", "/api/v1/topics/{topicId}", "topic-id"),
				A("update", "Update one topic", "PATCH", "/api/v1/topics/{topicId}", "topic-id").Body(),
				A("delete", "Delete one topic", "DELETE", "/api/v1/topics/{topicId}", "topic-id"),
			},
		},
		{
			Name: "contact-properties", Desc: "Manage contact property definitions",
			Actions: []Action{
				A("list", "List contact properties", "GET", "/api/v1/contact-properties"),
				A("create", "Create one contact property", "POST", "/api/v1/contact-properties").Body(),
				A("get", "Get one contact property", "GET", "/api/v1/contact-properties/{propertyId}", "property-id"),
				A("update", "Update one contact property", "PATCH", "/api/v1/contact-properties/{propertyId}", "property-id").Body(),
				A("delete", "Delete one contact property", "DELETE", "/api/v1/contact-properties/{propertyId}", "property-id"),
			},
		},
		{
			Name: "contacts", Desc: "Manage organization contacts",
			Actions: []Action{
				A("list", "List contacts", "GET", "/api/v1/contacts").Query(),
				A("create", "Create one contact", "POST", "/api/v1/contacts").Body(),
				A("get", "Get one contact by ID or email", "GET", "/api/v1/contacts/{contactId}", "contact-id-or-email"),
				A("update", "Update one contact by ID or email", "PATCH", "/api/v1/contacts/{contactId}", "contact-id-or-email").Body(),
				A("delete", "Delete one contact by ID or email", "DELETE", "/api/v1/contacts/{contactId}", "contact-id-or-email"),
				A("segments", "List one contact's segments", "GET", "/api/v1/contacts/{contactId}/segments", "contact-id-or-email"),
				A("add-to-segment", "Add one contact to one segment", "POST", "/api/v1/contacts/{contactId}/segments/{segmentId}", "contact-id-or-email", "segment-id"),
				A("remove-from-segment", "Remove one contact from one segment", "DELETE", "/api/v1/contacts/{contactId}/segments/{segmentId}", "contact-id-or-email", "segment-id"),
				A("topics", "List one contact's topics", "GET", "/api/v1/contacts/{contactId}/topics", "contact-id-or-email"),
				A("update-topics", "Replace one contact's topic subscriptions", "PATCH", "/api/v1/contacts/{contactId}/topics", "contact-id-or-email").Body(),
				A("imports", "List contact imports", "GET", "/api/v1/contacts/imports"),
				A("import", "Import contacts from a CSV file", "POST", "/api/v1/contacts/imports").File("form:file"),
				A("import-status", "Get one contact import", "GET", "/api/v1/contacts/imports/{importId}", "import-id"),
			},
		},
		{
			Name: "broadcasts", Desc: "Manage broadcasts",
			Actions: []Action{
				A("list", "List broadcasts", "GET", "/api/v1/broadcasts"),
				A("create", "Create one broadcast", "POST", "/api/v1/broadcasts").Body(),
				A("get", "Get one broadcast", "GET", "/api/v1/broadcasts/{broadcastId}", "broadcast-id"),
				A("update", "Update a scheduled broadcast", "PATCH", "/api/v1/broadcasts/{broadcastId}", "broadcast-id").Body(),
				A("delete", "Delete a scheduled broadcast", "DELETE", "/api/v1/broadcasts/{broadcastId}", "broadcast-id"),
				A("pause", "Pause a running broadcast", "POST", "/api/v1/broadcasts/{broadcastId}/pause", "broadcast-id"),
				A("resume", "Resume a paused broadcast", "POST", "/api/v1/broadcasts/{broadcastId}/resume", "broadcast-id"),
				A("cancel", "Cancel a broadcast", "POST", "/api/v1/broadcasts/{broadcastId}/cancel", "broadcast-id"),
				A("send", "Send or schedule a broadcast", "POST", "/api/v1/broadcasts/{broadcastId}/send", "broadcast-id").Body(),
				A("recipients", "List one broadcast's recipients", "GET", "/api/v1/broadcasts/{broadcastId}/recipients", "broadcast-id").Query(),
				A("clicked-links", "List one broadcast's clicked links", "GET", "/api/v1/broadcasts/{broadcastId}/clicked-links", "broadcast-id"),
			},
		},
		{
			Name: "suppressions", Desc: "Manage the suppression list",
			Actions: []Action{
				A("list", "List suppressions", "GET", "/api/v1/suppressions").Query(),
				A("create", "Create one suppression", "POST", "/api/v1/suppressions").Body(),
				A("get", "Get one suppression", "GET", "/api/v1/suppressions/{suppressionId}", "suppression-id"),
				A("update", "Update one suppression", "PATCH", "/api/v1/suppressions/{suppressionId}", "suppression-id").Body(),
				A("delete", "Delete one suppression", "DELETE", "/api/v1/suppressions/{suppressionId}", "suppression-id"),
				A("import", "Import suppressions from a CSV file", "POST", "/api/v1/suppressions/import").File("raw:text/csv"),
			},
		},
		{
			Name: "webhooks", Desc: "Manage outbound webhooks",
			Actions: []Action{
				A("list", "List webhooks", "GET", "/api/v1/webhooks"),
				A("configure", "Create or replace the default webhook (legacy)", "PUT", "/api/v1/webhooks").Body(),
				A("create", "Create one webhook", "POST", "/api/v1/webhooks").Body(),
				A("get", "Get one webhook", "GET", "/api/v1/webhooks/{webhookId}", "webhook-id"),
				A("update", "Update one webhook", "PATCH", "/api/v1/webhooks/{webhookId}", "webhook-id").Body(),
				A("delete", "Delete one webhook", "DELETE", "/api/v1/webhooks/{webhookId}", "webhook-id"),
				A("events", "List one webhook's events", "GET", "/api/v1/webhooks/{webhookId}/events", "webhook-id"),
				A("event", "Get one webhook event", "GET", "/api/v1/webhooks/{webhookId}/events/{eventId}", "webhook-id", "event-id"),
				A("replay", "Replay one webhook event", "POST", "/api/v1/webhooks/{webhookId}/events/{eventId}/replay", "webhook-id", "event-id"),
				A("attempts", "List one webhook event's attempts", "GET", "/api/v1/webhooks/{webhookId}/events/{eventId}/attempts", "webhook-id", "event-id"),
			},
		},
		{
			Name: "events", Desc: "Define and send custom events",
			Actions: []Action{
				A("list", "List custom event definitions", "GET", "/api/v1/events"),
				A("create", "Define one custom event", "POST", "/api/v1/events").Body(),
				A("get", "Get one custom event by ID or name", "GET", "/api/v1/events/{identifier}", "id-or-name"),
				A("update", "Update one custom event", "PATCH", "/api/v1/events/{identifier}", "id-or-name").Body(),
				A("delete", "Delete one custom event", "DELETE", "/api/v1/events/{identifier}", "id-or-name"),
				A("send", "Send one custom event", "POST", "/api/v1/events/send").Body(),
			},
		},
		{
			Name: "automations", Desc: "Manage automations",
			Actions: []Action{
				A("list", "List automations", "GET", "/api/v1/automations").Query(),
				A("create", "Create one automation", "POST", "/api/v1/automations").Body(),
				A("get", "Get one automation", "GET", "/api/v1/automations/{automationId}", "automation-id"),
				A("update", "Update one automation", "PATCH", "/api/v1/automations/{automationId}", "automation-id").Body(),
				A("delete", "Delete one automation", "DELETE", "/api/v1/automations/{automationId}", "automation-id"),
				A("duplicate", "Duplicate one automation as disabled", "POST", "/api/v1/automations/{automationId}/duplicate", "automation-id"),
				A("stop", "Stop one automation", "POST", "/api/v1/automations/{automationId}/stop", "automation-id"),
				A("runs", "List one automation's runs", "GET", "/api/v1/automations/{automationId}/runs", "automation-id"),
				A("run", "Get one automation run", "GET", "/api/v1/automations/{automationId}/runs/{runId}", "automation-id", "run-id"),
			},
		},
		{
			Name: "logs", Desc: "Inspect API request logs",
			Actions: []Action{
				A("list", "List request logs", "GET", "/api/v1/logs").Query(),
				A("get", "Get one request log", "GET", "/api/v1/logs/{logId}", "log-id"),
			},
		},
		{
			Name: "api-keys", Desc: "Manage scoped API keys",
			Actions: []Action{
				A("list", "List API keys", "GET", "/api/v1/api-keys"),
				A("create", "Create one API key", "POST", "/api/v1/api-keys").Body(),
				A("get", "Get one API key", "GET", "/api/v1/api-keys/{apiKeyId}", "api-key-id"),
				A("update", "Update one API key", "PATCH", "/api/v1/api-keys/{apiKeyId}", "api-key-id").Body(),
				A("revoke", "Revoke one API key", "DELETE", "/api/v1/api-keys/{apiKeyId}", "api-key-id"),
			},
		},
		{
			Name: "providers", Desc: "Manage outbound delivery providers",
			Actions: []Action{
				A("get", "Read provider settings", "GET", "/api/v1/providers"),
				A("ingest-event", "Ingest a provider event", "POST", "/api/v1/providers/aws-ses/events").Body(),
				A("ingest-org-event", "Ingest a provider event for one org", "POST", "/api/v1/providers/aws-ses/events/{orgId}", "org-id").Body(),
				A("update", "Update provider settings", "PATCH", "/api/v1/providers").Body(),
				A("test", "Test the configured provider", "POST", "/api/v1/providers/test").Body(),
			},
		},
		{
			Name: "rate-limits", Desc: "Read and manage send rate limits",
			Actions: []Action{
				A("get", "Read rate limit settings", "GET", "/api/v1/rate-limits"),
				A("update", "Update rate limit settings", "PATCH", "/api/v1/rate-limits").Body(),
			},
		},
		{
			Name: "open-tracking", Desc: "Manage open tracking",
			Actions: []Action{
				A("get", "Read open tracking settings", "GET", "/api/v1/open-tracking"),
				A("update", "Update open tracking settings", "PATCH", "/api/v1/open-tracking").Body(),
			},
		},
		{
			Name: "received", Desc: "Receive and read inbound email",
			Actions: []Action{
				A("receive", "Receive one inbound email", "POST", "/api/v1/received-emails").Body(),
				A("get", "Get one inbound email", "GET", "/api/v1/received-emails/{emailId}", "email-id"),
				A("attachments", "List one inbound email's attachments", "GET", "/api/v1/received-emails/{emailId}/attachments", "email-id"),
				A("attachment", "Get one inbound email attachment", "GET", "/api/v1/received-emails/{emailId}/attachments/{attachmentId}", "email-id", "attachment-id"),
			},
		},
		{
			Name: "attachments", Desc: "Download shared attachment bytes",
			Actions: []Action{
				A("download", "Download via a signed token URL query", "GET", "/api/v1/attachments/download").Query(),
			},
		},
		{
			Name: "shared", Desc: "Read a shared email via signed link",
			Actions: []Action{
				A("get", "Read one shared email", "GET", "/api/v1/shared/{token}", "token"),
			},
		},
	}
}

// Lookup finds a resource and action by name.
func Lookup(resource, action string) (*Resource, *Action, error) {
	for i := range resources {
		if resources[i].Name != resource {
			continue
		}
		for j := range resources[i].Actions {
			if resources[i].Actions[j].Name == action {
				return &resources[i], &resources[i].Actions[j], nil
			}
		}
		return &resources[i], nil, &usageError{msg: "unknown action " + action + " for resource " + resource}
	}
	return nil, nil, &usageError{msg: "unknown resource " + resource}
}

var resources = Resources()
