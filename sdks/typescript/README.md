# @paperboy/openapi@1.0.0

A TypeScript SDK client for the localhost API.

## Usage

First, install the SDK from npm.

```bash
npm install @paperboy/openapi --save
```

Next, try it out.


```ts
import {
  Configuration,
  APIKeysApi,
} from '@paperboy/openapi';
import type { CreateApiKeyRequest } from '@paperboy/openapi';

async function example() {
  console.log("🚀 Testing @paperboy/openapi SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new APIKeysApi(config);

  const body = {
    // ApiKeyInput
    apiKeyInput: ...,
  } satisfies CreateApiKeyRequest;

  try {
    const data = await api.createApiKey(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```


## Documentation

### API Endpoints

All URIs are relative to *http://localhost*

| Class | Method | HTTP request | Description
| ----- | ------ | ------------ | -------------
*APIKeysApi* | [**createApiKey**](docs/APIKeysApi.md#createapikey) | **POST** /api/v1/api-keys | Create one API key
*APIKeysApi* | [**getApiKey**](docs/APIKeysApi.md#getapikey) | **GET** /api/v1/api-keys/{apiKeyId} | Get one API key
*APIKeysApi* | [**listApiKeys**](docs/APIKeysApi.md#listapikeys) | **GET** /api/v1/api-keys | List API keys
*APIKeysApi* | [**revokeApiKey**](docs/APIKeysApi.md#revokeapikey) | **DELETE** /api/v1/api-keys/{apiKeyId} | Revoke one API key
*APIKeysApi* | [**updateApiKey**](docs/APIKeysApi.md#updateapikey) | **PATCH** /api/v1/api-keys/{apiKeyId} | Update one API key
*AudiencesApi* | [**createAudience**](docs/AudiencesApi.md#createaudience) | **POST** /api/v1/audiences | Create one audience
*AudiencesApi* | [**createContact**](docs/AudiencesApi.md#createcontact) | **POST** /api/v1/audiences/{audienceId}/contacts | Add one contact
*AudiencesApi* | [**deleteAudience**](docs/AudiencesApi.md#deleteaudience) | **DELETE** /api/v1/audiences/{audienceId} | Delete one audience
*AudiencesApi* | [**deleteContact**](docs/AudiencesApi.md#deletecontact) | **DELETE** /api/v1/audiences/{audienceId}/contacts/{contactId} | Delete one contact
*AudiencesApi* | [**getAudience**](docs/AudiencesApi.md#getaudience) | **GET** /api/v1/audiences/{audienceId} | Get one audience
*AudiencesApi* | [**getContact**](docs/AudiencesApi.md#getcontact) | **GET** /api/v1/audiences/{audienceId}/contacts/{contactId} | Get one contact
*AudiencesApi* | [**importContacts**](docs/AudiencesApi.md#importcontacts) | **POST** /api/v1/audiences/{audienceId}/contacts/import | Import contacts from CSV
*AudiencesApi* | [**listAudiences**](docs/AudiencesApi.md#listaudiences) | **GET** /api/v1/audiences | List audiences
*AudiencesApi* | [**listContacts**](docs/AudiencesApi.md#listcontacts) | **GET** /api/v1/audiences/{audienceId}/contacts | List audience contacts
*AudiencesApi* | [**updateAudience**](docs/AudiencesApi.md#updateaudience) | **PATCH** /api/v1/audiences/{audienceId} | Rename one audience
*AudiencesApi* | [**updateContact**](docs/AudiencesApi.md#updatecontact) | **PATCH** /api/v1/audiences/{audienceId}/contacts/{contactId} | Update one contact
*AutomationsApi* | [**createAutomation**](docs/AutomationsApi.md#createautomation) | **POST** /api/v1/automations | Create one automation
*AutomationsApi* | [**deleteAutomation**](docs/AutomationsApi.md#deleteautomation) | **DELETE** /api/v1/automations/{automationId} | Delete one automation
*AutomationsApi* | [**duplicateAutomation**](docs/AutomationsApi.md#duplicateautomation) | **POST** /api/v1/automations/{automationId}/duplicate | Duplicate one automation as disabled
*AutomationsApi* | [**getAutomation**](docs/AutomationsApi.md#getautomation) | **GET** /api/v1/automations/{automationId} | Get one automation
*AutomationsApi* | [**getAutomationRun**](docs/AutomationsApi.md#getautomationrun) | **GET** /api/v1/automations/{automationId}/runs/{runId} | Get one automation run
*AutomationsApi* | [**listAutomationRuns**](docs/AutomationsApi.md#listautomationruns) | **GET** /api/v1/automations/{automationId}/runs | List one automation\&#39;s runs
*AutomationsApi* | [**listAutomations**](docs/AutomationsApi.md#listautomations) | **GET** /api/v1/automations | List automations
*AutomationsApi* | [**stopAutomation**](docs/AutomationsApi.md#stopautomation) | **POST** /api/v1/automations/{automationId}/stop | Stop one automation
*AutomationsApi* | [**updateAutomation**](docs/AutomationsApi.md#updateautomation) | **PATCH** /api/v1/automations/{automationId} | Update one automation
*BroadcastsApi* | [**cancelBroadcast**](docs/BroadcastsApi.md#cancelbroadcast) | **POST** /api/v1/broadcasts/{broadcastId}/cancel | Cancel a broadcast
*BroadcastsApi* | [**createBroadcast**](docs/BroadcastsApi.md#createbroadcast) | **POST** /api/v1/broadcasts | Create one broadcast
*BroadcastsApi* | [**deleteBroadcast**](docs/BroadcastsApi.md#deletebroadcast) | **DELETE** /api/v1/broadcasts/{broadcastId} | Delete a broadcast
*BroadcastsApi* | [**getBroadcast**](docs/BroadcastsApi.md#getbroadcast) | **GET** /api/v1/broadcasts/{broadcastId} | Get one broadcast
*BroadcastsApi* | [**listBroadcastClickedLinks**](docs/BroadcastsApi.md#listbroadcastclickedlinks) | **GET** /api/v1/broadcasts/{broadcastId}/clicked-links | List one broadcast\&#39;s clicked links
*BroadcastsApi* | [**listBroadcastRecipients**](docs/BroadcastsApi.md#listbroadcastrecipients) | **GET** /api/v1/broadcasts/{broadcastId}/recipients | List one broadcast\&#39;s recipients
*BroadcastsApi* | [**listBroadcasts**](docs/BroadcastsApi.md#listbroadcasts) | **GET** /api/v1/broadcasts | List broadcasts
*BroadcastsApi* | [**pauseBroadcast**](docs/BroadcastsApi.md#pausebroadcast) | **POST** /api/v1/broadcasts/{broadcastId}/pause | Pause a running broadcast
*BroadcastsApi* | [**resumeBroadcast**](docs/BroadcastsApi.md#resumebroadcast) | **POST** /api/v1/broadcasts/{broadcastId}/resume | Resume a paused broadcast
*BroadcastsApi* | [**sendBroadcast**](docs/BroadcastsApi.md#sendbroadcast) | **POST** /api/v1/broadcasts/{broadcastId}/send | Send or schedule a broadcast
*BroadcastsApi* | [**updateBroadcast**](docs/BroadcastsApi.md#updatebroadcast) | **PATCH** /api/v1/broadcasts/{broadcastId} | Update a scheduled broadcast
*ContactPropertiesApi* | [**createContactProperty**](docs/ContactPropertiesApi.md#createcontactproperty) | **POST** /api/v1/contact-properties | Create one contact property
*ContactPropertiesApi* | [**deleteContactProperty**](docs/ContactPropertiesApi.md#deletecontactproperty) | **DELETE** /api/v1/contact-properties/{propertyId} | Delete one contact property
*ContactPropertiesApi* | [**getContactProperty**](docs/ContactPropertiesApi.md#getcontactproperty) | **GET** /api/v1/contact-properties/{propertyId} | Get one contact property
*ContactPropertiesApi* | [**listContactProperties**](docs/ContactPropertiesApi.md#listcontactproperties) | **GET** /api/v1/contact-properties | List contact properties
*ContactPropertiesApi* | [**updateContactProperty**](docs/ContactPropertiesApi.md#updatecontactproperty) | **PATCH** /api/v1/contact-properties/{propertyId} | Update one contact property
*ContactsApi* | [**addContactToSegment**](docs/ContactsApi.md#addcontacttosegment) | **POST** /api/v1/contacts/{contactId}/segments/{segmentId} | Add one contact to one segment
*ContactsApi* | [**createContactImport**](docs/ContactsApi.md#createcontactimportoperation) | **POST** /api/v1/contacts/imports | Import contacts from CSV
*ContactsApi* | [**createOrgContact**](docs/ContactsApi.md#createorgcontact) | **POST** /api/v1/contacts | Create one contact
*ContactsApi* | [**deleteOrgContact**](docs/ContactsApi.md#deleteorgcontact) | **DELETE** /api/v1/contacts/{contactId} | Delete one contact by ID or email
*ContactsApi* | [**getContactImport**](docs/ContactsApi.md#getcontactimport) | **GET** /api/v1/contacts/imports/{importId} | Get one contact import
*ContactsApi* | [**getOrgContact**](docs/ContactsApi.md#getorgcontact) | **GET** /api/v1/contacts/{contactId} | Get one contact by ID or email
*ContactsApi* | [**listContactImports**](docs/ContactsApi.md#listcontactimports) | **GET** /api/v1/contacts/imports | List contact imports
*ContactsApi* | [**listContactSegments**](docs/ContactsApi.md#listcontactsegments) | **GET** /api/v1/contacts/{contactId}/segments | List one contact\&#39;s segments
*ContactsApi* | [**listContactTopics**](docs/ContactsApi.md#listcontacttopics) | **GET** /api/v1/contacts/{contactId}/topics | List one contact\&#39;s topics
*ContactsApi* | [**listOrgContacts**](docs/ContactsApi.md#listorgcontacts) | **GET** /api/v1/contacts | List contacts
*ContactsApi* | [**removeContactFromSegment**](docs/ContactsApi.md#removecontactfromsegment) | **DELETE** /api/v1/contacts/{contactId}/segments/{segmentId} | Remove one contact from one segment
*ContactsApi* | [**updateContactTopics**](docs/ContactsApi.md#updatecontacttopics) | **PATCH** /api/v1/contacts/{contactId}/topics | Replace one contact\&#39;s topic subscriptions
*ContactsApi* | [**updateOrgContact**](docs/ContactsApi.md#updateorgcontact) | **PATCH** /api/v1/contacts/{contactId} | Update one contact by ID or email
*CustomEventsApi* | [**createEvent**](docs/CustomEventsApi.md#createevent) | **POST** /api/v1/events | Define one custom event
*CustomEventsApi* | [**deleteEvent**](docs/CustomEventsApi.md#deleteevent) | **DELETE** /api/v1/events/{identifier} | Delete one custom event
*CustomEventsApi* | [**getEvent**](docs/CustomEventsApi.md#getevent) | **GET** /api/v1/events/{identifier} | Get one custom event
*CustomEventsApi* | [**listEvents**](docs/CustomEventsApi.md#listevents) | **GET** /api/v1/events | List custom events
*CustomEventsApi* | [**sendEvent**](docs/CustomEventsApi.md#sendevent) | **POST** /api/v1/events/send | Send one custom event
*CustomEventsApi* | [**updateEvent**](docs/CustomEventsApi.md#updateevent) | **PATCH** /api/v1/events/{identifier} | Update one custom event
*EmailsApi* | [**cancelEmail**](docs/EmailsApi.md#cancelemail) | **POST** /api/v1/emails/{emailId}/cancel | Cancel a queued email
*EmailsApi* | [**downloadAttachment**](docs/EmailsApi.md#downloadattachment) | **GET** /api/v1/attachments/download | Download shared attachment bytes
*EmailsApi* | [**getEmail**](docs/EmailsApi.md#getemail) | **GET** /api/v1/emails/{emailId} | Get one email
*EmailsApi* | [**getEmailAttachment**](docs/EmailsApi.md#getemailattachment) | **GET** /api/v1/emails/{emailId}/attachments/{attachmentId} | Get one email attachment
*EmailsApi* | [**getEmailMetrics**](docs/EmailsApi.md#getemailmetrics) | **GET** /api/v1/emails/metrics | Aggregate email metrics
*EmailsApi* | [**getReceivedEmail**](docs/EmailsApi.md#getreceivedemail) | **GET** /api/v1/received-emails/{emailId} | Get one inbound email
*EmailsApi* | [**getReceivedEmailAttachment**](docs/EmailsApi.md#getreceivedemailattachment) | **GET** /api/v1/received-emails/{emailId}/attachments/{attachmentId} | Get one inbound email attachment
*EmailsApi* | [**getSharedEmail**](docs/EmailsApi.md#getsharedemail) | **GET** /api/v1/shared/{token} | Read a shared email
*EmailsApi* | [**listEmailAttachments**](docs/EmailsApi.md#listemailattachments) | **GET** /api/v1/emails/{emailId}/attachments | List one email\&#39;s attachments
*EmailsApi* | [**listEmails**](docs/EmailsApi.md#listemails) | **GET** /api/v1/emails | List emails
*EmailsApi* | [**listReceivedEmailAttachments**](docs/EmailsApi.md#listreceivedemailattachments) | **GET** /api/v1/received-emails/{emailId}/attachments | List one inbound email\&#39;s attachments
*EmailsApi* | [**receiveInboundEmail**](docs/EmailsApi.md#receiveinboundemail) | **POST** /api/v1/received-emails | Store one inbound email
*EmailsApi* | [**rescheduleEmail**](docs/EmailsApi.md#rescheduleemail) | **PATCH** /api/v1/emails/{emailId} | Reschedule a queued email
*EmailsApi* | [**sendEmail**](docs/EmailsApi.md#sendemail) | **POST** /api/v1/emails | Queue one email
*EmailsApi* | [**sendEmailBatch**](docs/EmailsApi.md#sendemailbatch) | **POST** /api/v1/emails/batch | Queue one to 100 emails
*EmailsApi* | [**shareEmail**](docs/EmailsApi.md#shareemail) | **POST** /api/v1/emails/{emailId}/share | Create a shareable link for one email
*EventsApi* | [**listEmailEvents**](docs/EventsApi.md#listemailevents) | **GET** /api/v1/emails/{emailId}/events | List one email\&#39;s events
*LogsApi* | [**getLog**](docs/LogsApi.md#getlog) | **GET** /api/v1/logs/{logId} | Get one API request log
*LogsApi* | [**listLogs**](docs/LogsApi.md#listlogs) | **GET** /api/v1/logs | List API request logs
*OpenTrackingApi* | [**getOpenTracking**](docs/OpenTrackingApi.md#getopentracking) | **GET** /api/v1/open-tracking | Read organization open tracking
*OpenTrackingApi* | [**recordClick**](docs/OpenTrackingApi.md#recordclick) | **GET** /c/{messageId}/{signature} | Follow a signed first-party click redirect
*OpenTrackingApi* | [**recordOpen**](docs/OpenTrackingApi.md#recordopen) | **GET** /o/{messageId}/{signature}.gif | Fetch the signed first-party open pixel
*OpenTrackingApi* | [**updateOpenTracking**](docs/OpenTrackingApi.md#updateopentracking) | **PATCH** /api/v1/open-tracking | Update organization open tracking
*OutboundProvidersApi* | [**getOutboundProviders**](docs/OutboundProvidersApi.md#getoutboundproviders) | **GET** /api/v1/providers | Read outbound-provider routing
*OutboundProvidersApi* | [**ingestAwsSesEvent**](docs/OutboundProvidersApi.md#ingestawssesevent) | **POST** /api/v1/providers/aws-ses/events | Ingest one Amazon SES event
*OutboundProvidersApi* | [**receiveAwsSesSnsEvent**](docs/OutboundProvidersApi.md#receiveawssessnsevent) | **POST** /api/v1/providers/aws-ses/events/{orgId} | Receive one signed Amazon SNS notification
*OutboundProvidersApi* | [**testOutboundProvider**](docs/OutboundProvidersApi.md#testoutboundprovider) | **POST** /api/v1/providers/test | Test one outbound provider
*OutboundProvidersApi* | [**updateOutboundProviders**](docs/OutboundProvidersApi.md#updateoutboundproviders) | **PATCH** /api/v1/providers | Update outbound-provider routing
*RateLimitsApi* | [**getRateLimits**](docs/RateLimitsApi.md#getratelimits) | **GET** /api/v1/rate-limits | Read organization send-rate limits
*RateLimitsApi* | [**updateRateLimits**](docs/RateLimitsApi.md#updateratelimits) | **PATCH** /api/v1/rate-limits | Override organization send-rate limits
*SegmentsApi* | [**createSegment**](docs/SegmentsApi.md#createsegment) | **POST** /api/v1/segments | Create one segment
*SegmentsApi* | [**deleteSegment**](docs/SegmentsApi.md#deletesegment) | **DELETE** /api/v1/segments/{segmentId} | Delete one segment
*SegmentsApi* | [**getSegment**](docs/SegmentsApi.md#getsegment) | **GET** /api/v1/segments/{segmentId} | Get one segment
*SegmentsApi* | [**listSegments**](docs/SegmentsApi.md#listsegments) | **GET** /api/v1/segments | List segments
*SegmentsApi* | [**updateSegment**](docs/SegmentsApi.md#updatesegment) | **PATCH** /api/v1/segments/{segmentId} | Update one segment
*SuppressionsApi* | [**createSuppression**](docs/SuppressionsApi.md#createsuppression) | **POST** /api/v1/suppressions | Create one suppression
*SuppressionsApi* | [**deleteSuppression**](docs/SuppressionsApi.md#deletesuppression) | **DELETE** /api/v1/suppressions/{suppressionId} | Delete one suppression
*SuppressionsApi* | [**getSuppression**](docs/SuppressionsApi.md#getsuppression) | **GET** /api/v1/suppressions/{suppressionId} | Get one suppression
*SuppressionsApi* | [**importSuppressions**](docs/SuppressionsApi.md#importsuppressions) | **POST** /api/v1/suppressions/import | Import suppressions from CSV
*SuppressionsApi* | [**listSuppressions**](docs/SuppressionsApi.md#listsuppressions) | **GET** /api/v1/suppressions | List suppressions
*SuppressionsApi* | [**updateSuppression**](docs/SuppressionsApi.md#updatesuppression) | **PATCH** /api/v1/suppressions/{suppressionId} | Update one suppression
*TemplatesApi* | [**createTemplate**](docs/TemplatesApi.md#createtemplate) | **POST** /api/v1/templates | Create one template
*TemplatesApi* | [**deleteTemplate**](docs/TemplatesApi.md#deletetemplate) | **DELETE** /api/v1/templates/{templateId} | Delete one template
*TemplatesApi* | [**duplicateTemplate**](docs/TemplatesApi.md#duplicatetemplate) | **POST** /api/v1/templates/{templateId}/duplicate | Duplicate one template as a new draft
*TemplatesApi* | [**getTemplate**](docs/TemplatesApi.md#gettemplate) | **GET** /api/v1/templates/{templateId} | Get one template
*TemplatesApi* | [**listTemplates**](docs/TemplatesApi.md#listtemplates) | **GET** /api/v1/templates | List templates
*TemplatesApi* | [**previewTemplate**](docs/TemplatesApi.md#previewtemplate) | **POST** /api/v1/templates/{templateId}/preview | Render one template without sending
*TemplatesApi* | [**publishTemplate**](docs/TemplatesApi.md#publishtemplate) | **POST** /api/v1/templates/{templateId}/publish | Publish one template
*TemplatesApi* | [**updateTemplate**](docs/TemplatesApi.md#updatetemplate) | **PATCH** /api/v1/templates/{templateId} | Update one template
*TopicsApi* | [**createTopic**](docs/TopicsApi.md#createtopic) | **POST** /api/v1/topics | Create one topic
*TopicsApi* | [**deleteTopic**](docs/TopicsApi.md#deletetopic) | **DELETE** /api/v1/topics/{topicId} | Delete one topic
*TopicsApi* | [**getTopic**](docs/TopicsApi.md#gettopic) | **GET** /api/v1/topics/{topicId} | Get one topic
*TopicsApi* | [**listTopics**](docs/TopicsApi.md#listtopics) | **GET** /api/v1/topics | List topics
*TopicsApi* | [**updateTopic**](docs/TopicsApi.md#updatetopic) | **PATCH** /api/v1/topics/{topicId} | Update one topic
*WebhooksApi* | [**configureWebhook**](docs/WebhooksApi.md#configurewebhook) | **PUT** /api/v1/webhooks | Configure webhook delivery
*WebhooksApi* | [**createWebhook**](docs/WebhooksApi.md#createwebhook) | **POST** /api/v1/webhooks | Create one webhook
*WebhooksApi* | [**deleteWebhook**](docs/WebhooksApi.md#deletewebhook) | **DELETE** /api/v1/webhooks/{webhookId} | Delete one webhook
*WebhooksApi* | [**getWebhookById**](docs/WebhooksApi.md#getwebhookbyid) | **GET** /api/v1/webhooks/{webhookId} | Get one webhook
*WebhooksApi* | [**getWebhookEvent**](docs/WebhooksApi.md#getwebhookevent) | **GET** /api/v1/webhooks/{webhookId}/events/{eventId} | Get one webhook event
*WebhooksApi* | [**listWebhookEventAttempts**](docs/WebhooksApi.md#listwebhookeventattempts) | **GET** /api/v1/webhooks/{webhookId}/events/{eventId}/attempts | List one webhook event\&#39;s attempts
*WebhooksApi* | [**listWebhookEvents**](docs/WebhooksApi.md#listwebhookevents) | **GET** /api/v1/webhooks/{webhookId}/events | List one webhook\&#39;s events
*WebhooksApi* | [**listWebhooks**](docs/WebhooksApi.md#listwebhooks) | **GET** /api/v1/webhooks | List webhooks
*WebhooksApi* | [**replayWebhookEvent**](docs/WebhooksApi.md#replaywebhookevent) | **POST** /api/v1/webhooks/{webhookId}/events/{eventId}/replay | Replay one webhook event
*WebhooksApi* | [**updateWebhook**](docs/WebhooksApi.md#updatewebhook) | **PATCH** /api/v1/webhooks/{webhookId} | Update one webhook


### Models

- [ApiKey](docs/ApiKey.md)
- [ApiKeyInput](docs/ApiKeyInput.md)
- [ApiKeyListEnvelope](docs/ApiKeyListEnvelope.md)
- [ApiKeySecret](docs/ApiKeySecret.md)
- [ApiKeyUpdateInput](docs/ApiKeyUpdateInput.md)
- [ApiLog](docs/ApiLog.md)
- [ApiLogListEnvelope](docs/ApiLogListEnvelope.md)
- [Audience](docs/Audience.md)
- [AudienceInput](docs/AudienceInput.md)
- [AudienceListEnvelope](docs/AudienceListEnvelope.md)
- [Automation](docs/Automation.md)
- [AutomationInput](docs/AutomationInput.md)
- [AutomationListEnvelope](docs/AutomationListEnvelope.md)
- [AutomationRun](docs/AutomationRun.md)
- [AutomationRunListEnvelope](docs/AutomationRunListEnvelope.md)
- [AutomationUpdateInput](docs/AutomationUpdateInput.md)
- [AwsSnsEnvelope](docs/AwsSnsEnvelope.md)
- [Broadcast](docs/Broadcast.md)
- [BroadcastClickedLink](docs/BroadcastClickedLink.md)
- [BroadcastClickedLinkListEnvelope](docs/BroadcastClickedLinkListEnvelope.md)
- [BroadcastCreateInput](docs/BroadcastCreateInput.md)
- [BroadcastEnvelope](docs/BroadcastEnvelope.md)
- [BroadcastListEnvelope](docs/BroadcastListEnvelope.md)
- [BroadcastProgress](docs/BroadcastProgress.md)
- [BroadcastRecipient](docs/BroadcastRecipient.md)
- [BroadcastRecipientListEnvelope](docs/BroadcastRecipientListEnvelope.md)
- [BroadcastSendInput](docs/BroadcastSendInput.md)
- [BroadcastUpdateInput](docs/BroadcastUpdateInput.md)
- [Contact](docs/Contact.md)
- [ContactImport](docs/ContactImport.md)
- [ContactImportInput](docs/ContactImportInput.md)
- [ContactImportListEnvelope](docs/ContactImportListEnvelope.md)
- [ContactInput](docs/ContactInput.md)
- [ContactListEnvelope](docs/ContactListEnvelope.md)
- [ContactProperty](docs/ContactProperty.md)
- [ContactPropertyInput](docs/ContactPropertyInput.md)
- [ContactPropertyInputFallbackValue](docs/ContactPropertyInputFallbackValue.md)
- [ContactPropertyListEnvelope](docs/ContactPropertyListEnvelope.md)
- [ContactPropertyUpdateInput](docs/ContactPropertyUpdateInput.md)
- [ContactSegmentListEnvelope](docs/ContactSegmentListEnvelope.md)
- [ContactSegmentRef](docs/ContactSegmentRef.md)
- [ContactTopicListEnvelope](docs/ContactTopicListEnvelope.md)
- [ContactTopicRef](docs/ContactTopicRef.md)
- [ContactTopicsUpdateInput](docs/ContactTopicsUpdateInput.md)
- [CustomEvent](docs/CustomEvent.md)
- [CustomEventInput](docs/CustomEventInput.md)
- [CustomEventListEnvelope](docs/CustomEventListEnvelope.md)
- [CustomEventUpdateInput](docs/CustomEventUpdateInput.md)
- [DeletedResource](docs/DeletedResource.md)
- [Email](docs/Email.md)
- [EmailAttachment](docs/EmailAttachment.md)
- [EmailBatchEnvelope](docs/EmailBatchEnvelope.md)
- [EmailBatchItem](docs/EmailBatchItem.md)
- [EmailListEnvelope](docs/EmailListEnvelope.md)
- [EmailMetrics](docs/EmailMetrics.md)
- [EmailMetricsDataInner](docs/EmailMetricsDataInner.md)
- [EmailMetricsDataInnerDataInner](docs/EmailMetricsDataInnerDataInner.md)
- [EmailSummary](docs/EmailSummary.md)
- [EmailTag](docs/EmailTag.md)
- [ErrorEnvelope](docs/ErrorEnvelope.md)
- [ErrorEnvelopeError](docs/ErrorEnvelopeError.md)
- [EventOccurrence](docs/EventOccurrence.md)
- [EventOccurrenceEnvelope](docs/EventOccurrenceEnvelope.md)
- [InlineEmailInput](docs/InlineEmailInput.md)
- [InlineEmailInputAnyOf](docs/InlineEmailInputAnyOf.md)
- [InlineEmailInputAnyOf1](docs/InlineEmailInputAnyOf1.md)
- [ListEmailEvents200Response](docs/ListEmailEvents200Response.md)
- [MessageEvent](docs/MessageEvent.md)
- [MessageOutboundProvider](docs/MessageOutboundProvider.md)
- [OpenTrackingSettings](docs/OpenTrackingSettings.md)
- [OpenTrackingUpdateInput](docs/OpenTrackingUpdateInput.md)
- [OrgContact](docs/OrgContact.md)
- [OrgContactInput](docs/OrgContactInput.md)
- [OrgContactInputSegmentsInner](docs/OrgContactInputSegmentsInner.md)
- [OrgContactInputTopicsInner](docs/OrgContactInputTopicsInner.md)
- [OrgContactListEnvelope](docs/OrgContactListEnvelope.md)
- [OrgContactUpdateInput](docs/OrgContactUpdateInput.md)
- [OutboundProvider](docs/OutboundProvider.md)
- [OutboundProviderCapabilities](docs/OutboundProviderCapabilities.md)
- [OutboundProviderConnectionDetails](docs/OutboundProviderConnectionDetails.md)
- [OutboundProviderDomainOverrideInput](docs/OutboundProviderDomainOverrideInput.md)
- [OutboundProviderDomainSetting](docs/OutboundProviderDomainSetting.md)
- [OutboundProviderEventEnvelope](docs/OutboundProviderEventEnvelope.md)
- [OutboundProviderEventResult](docs/OutboundProviderEventResult.md)
- [OutboundProviderSettings](docs/OutboundProviderSettings.md)
- [OutboundProviderStatus](docs/OutboundProviderStatus.md)
- [OutboundProviderTestInput](docs/OutboundProviderTestInput.md)
- [OutboundProviderTestResult](docs/OutboundProviderTestResult.md)
- [OutboundProviderUpdateInput](docs/OutboundProviderUpdateInput.md)
- [QueuedEmail](docs/QueuedEmail.md)
- [RateLimitErrorEnvelope](docs/RateLimitErrorEnvelope.md)
- [RateLimitErrorEnvelopeError](docs/RateLimitErrorEnvelopeError.md)
- [RateLimitLane](docs/RateLimitLane.md)
- [RateLimitSettings](docs/RateLimitSettings.md)
- [RateLimitUpdateInput](docs/RateLimitUpdateInput.md)
- [ReceiveInboundEmailInput](docs/ReceiveInboundEmailInput.md)
- [ReceivedEmail](docs/ReceivedEmail.md)
- [ReceivedEmailAccepted](docs/ReceivedEmailAccepted.md)
- [ReceivedEmailDiscarded](docs/ReceivedEmailDiscarded.md)
- [Recipients](docs/Recipients.md)
- [RescheduleEmailInput](docs/RescheduleEmailInput.md)
- [RetrievedEmailAttachment](docs/RetrievedEmailAttachment.md)
- [RetrievedEmailAttachmentListEnvelope](docs/RetrievedEmailAttachmentListEnvelope.md)
- [Segment](docs/Segment.md)
- [SegmentInput](docs/SegmentInput.md)
- [SegmentListEnvelope](docs/SegmentListEnvelope.md)
- [SendEmailInput](docs/SendEmailInput.md)
- [SendEventInput](docs/SendEventInput.md)
- [ShareEmailInput](docs/ShareEmailInput.md)
- [SharedEmail](docs/SharedEmail.md)
- [SharedEmailContent](docs/SharedEmailContent.md)
- [StoredAttachment](docs/StoredAttachment.md)
- [Suppression](docs/Suppression.md)
- [SuppressionInput](docs/SuppressionInput.md)
- [SuppressionListEnvelope](docs/SuppressionListEnvelope.md)
- [SuppressionReason](docs/SuppressionReason.md)
- [SuppressionUpdateInput](docs/SuppressionUpdateInput.md)
- [Template](docs/Template.md)
- [TemplateEmailInput](docs/TemplateEmailInput.md)
- [TemplateInput](docs/TemplateInput.md)
- [TemplateListEnvelope](docs/TemplateListEnvelope.md)
- [TemplatePreview](docs/TemplatePreview.md)
- [TemplatePreviewInput](docs/TemplatePreviewInput.md)
- [Topic](docs/Topic.md)
- [TopicInput](docs/TopicInput.md)
- [TopicListEnvelope](docs/TopicListEnvelope.md)
- [TopicUpdateInput](docs/TopicUpdateInput.md)
- [ValidationIssue](docs/ValidationIssue.md)
- [Webhook](docs/Webhook.md)
- [WebhookConfigurationEnvelope](docs/WebhookConfigurationEnvelope.md)
- [WebhookConfigurationInput](docs/WebhookConfigurationInput.md)
- [WebhookConfiguredEndpoint](docs/WebhookConfiguredEndpoint.md)
- [WebhookCreateEnvelope](docs/WebhookCreateEnvelope.md)
- [WebhookCreateInput](docs/WebhookCreateInput.md)
- [WebhookDelivery](docs/WebhookDelivery.md)
- [WebhookDeliveryAttempt](docs/WebhookDeliveryAttempt.md)
- [WebhookDeliveryAttemptListEnvelope](docs/WebhookDeliveryAttemptListEnvelope.md)
- [WebhookDeliveryListEnvelope](docs/WebhookDeliveryListEnvelope.md)
- [WebhookEndpoint](docs/WebhookEndpoint.md)
- [WebhookEvent](docs/WebhookEvent.md)
- [WebhookEventData](docs/WebhookEventData.md)
- [WebhookListEnvelope](docs/WebhookListEnvelope.md)
- [WebhookReadEnvelope](docs/WebhookReadEnvelope.md)
- [WebhookUpdateInput](docs/WebhookUpdateInput.md)

### Authorization


Authentication schemes defined for the API:
<a id="bearerAuth"></a>
#### bearerAuth


- **Type**: HTTP Bearer Token authentication (pb_live_... or pb_test_...)

## About

This TypeScript SDK client supports the [Fetch API](https://fetch.spec.whatwg.org/)
and is automatically generated by the
[OpenAPI Generator](https://openapi-generator.tech) project:

- API version: `1.0.0`
- Package version: `1.0.0`
- Generator version: `7.24.0`
- Build package: `org.openapitools.codegen.languages.TypeScriptFetchClientCodegen`

The generated npm module supports the following:

- Environments
  * Node.js
  * Webpack
  * Browserify
- Language levels
  * ES5 - you must have a Promises/A+ library installed
  * ES6
- Module systems
  * CommonJS
  * ES6 module system


## Development

### Building

To build the TypeScript source code, you need to have Node.js and npm installed.
After cloning the repository, navigate to the project directory and run:

```bash
npm install
npm run build
```

### Publishing

Once you've built the package, you can publish it to npm:

```bash
npm publish
```

## License

[Proprietary]()
