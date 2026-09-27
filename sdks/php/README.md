# paperboy/openapi

Tenant-bound transactional email API. API keys select one organization and one live or test environment. Stored instants and HTTP timestamps are RFC 3339 UTC. The queue is provider-neutral: self-hosted SMTP and Cloudflare Email Service and Amazon SES use the same messages, limits, suppressions, and event model. The signed-in console renders this contract at `/app/docs`. The Rust CLI in `crates/paperboy` calls the same bearer-key routes.


## Installation & Usage

### Requirements

PHP 8.1 and later.

### Composer

To install the bindings via [Composer](https://getcomposer.org/), add the following to `composer.json`:

```json
{
  "repositories": [
    {
      "type": "vcs",
      "url": "https://github.com/GIT_USER_ID/GIT_REPO_ID.git"
    }
  ],
  "require": {
    "GIT_USER_ID/GIT_REPO_ID": "*@dev"
  }
}
```

Then run `composer install`

### Manual Installation

Download the files and include `autoload.php`:

```php
<?php
require_once('/path/to/paperboy/openapi/vendor/autoload.php');
```

## Getting Started

Please follow the [installation procedure](#installation--usage) and then run the following:

```php
<?php
require_once(__DIR__ . '/vendor/autoload.php');



// Configure Bearer (pb_live_... or pb_test_...) authorization: bearerAuth
$config = PaperBoy\OpenApi\Configuration::getDefaultConfiguration()->setAccessToken('YOUR_ACCESS_TOKEN');


$apiInstance = new PaperBoy\OpenApi\Api\APIKeysApi(
    // If you want use custom http client, pass your client which implements `GuzzleHttp\ClientInterface`.
    // This is optional, `GuzzleHttp\Client` will be used as default.
    new GuzzleHttp\Client(),
    $config
);
$api_key_input = new \PaperBoy\OpenApi\Model\ApiKeyInput(); // \PaperBoy\OpenApi\Model\ApiKeyInput

try {
    $result = $apiInstance->createApiKey($api_key_input);
    print_r($result);
} catch (Exception $e) {
    echo 'Exception when calling APIKeysApi->createApiKey: ', $e->getMessage(), PHP_EOL;
}

```

## API Endpoints

All URIs are relative to *http://localhost*

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
*APIKeysApi* | [**createApiKey**](docs/Api/APIKeysApi.md#createapikey) | **POST** /api/v1/api-keys | Create one API key
*APIKeysApi* | [**getApiKey**](docs/Api/APIKeysApi.md#getapikey) | **GET** /api/v1/api-keys/{apiKeyId} | Get one API key
*APIKeysApi* | [**listApiKeys**](docs/Api/APIKeysApi.md#listapikeys) | **GET** /api/v1/api-keys | List API keys
*APIKeysApi* | [**revokeApiKey**](docs/Api/APIKeysApi.md#revokeapikey) | **DELETE** /api/v1/api-keys/{apiKeyId} | Revoke one API key
*APIKeysApi* | [**updateApiKey**](docs/Api/APIKeysApi.md#updateapikey) | **PATCH** /api/v1/api-keys/{apiKeyId} | Update one API key
*AudiencesApi* | [**createAudience**](docs/Api/AudiencesApi.md#createaudience) | **POST** /api/v1/audiences | Create one audience
*AudiencesApi* | [**createContact**](docs/Api/AudiencesApi.md#createcontact) | **POST** /api/v1/audiences/{audienceId}/contacts | Add one contact
*AudiencesApi* | [**deleteAudience**](docs/Api/AudiencesApi.md#deleteaudience) | **DELETE** /api/v1/audiences/{audienceId} | Delete one audience
*AudiencesApi* | [**deleteContact**](docs/Api/AudiencesApi.md#deletecontact) | **DELETE** /api/v1/audiences/{audienceId}/contacts/{contactId} | Delete one contact
*AudiencesApi* | [**getAudience**](docs/Api/AudiencesApi.md#getaudience) | **GET** /api/v1/audiences/{audienceId} | Get one audience
*AudiencesApi* | [**getContact**](docs/Api/AudiencesApi.md#getcontact) | **GET** /api/v1/audiences/{audienceId}/contacts/{contactId} | Get one contact
*AudiencesApi* | [**importContacts**](docs/Api/AudiencesApi.md#importcontacts) | **POST** /api/v1/audiences/{audienceId}/contacts/import | Import contacts from CSV
*AudiencesApi* | [**listAudiences**](docs/Api/AudiencesApi.md#listaudiences) | **GET** /api/v1/audiences | List audiences
*AudiencesApi* | [**listContacts**](docs/Api/AudiencesApi.md#listcontacts) | **GET** /api/v1/audiences/{audienceId}/contacts | List audience contacts
*AudiencesApi* | [**updateAudience**](docs/Api/AudiencesApi.md#updateaudience) | **PATCH** /api/v1/audiences/{audienceId} | Rename one audience
*AudiencesApi* | [**updateContact**](docs/Api/AudiencesApi.md#updatecontact) | **PATCH** /api/v1/audiences/{audienceId}/contacts/{contactId} | Update one contact
*AutomationsApi* | [**createAutomation**](docs/Api/AutomationsApi.md#createautomation) | **POST** /api/v1/automations | Create one automation
*AutomationsApi* | [**deleteAutomation**](docs/Api/AutomationsApi.md#deleteautomation) | **DELETE** /api/v1/automations/{automationId} | Delete one automation
*AutomationsApi* | [**duplicateAutomation**](docs/Api/AutomationsApi.md#duplicateautomation) | **POST** /api/v1/automations/{automationId}/duplicate | Duplicate one automation as disabled
*AutomationsApi* | [**getAutomation**](docs/Api/AutomationsApi.md#getautomation) | **GET** /api/v1/automations/{automationId} | Get one automation
*AutomationsApi* | [**getAutomationRun**](docs/Api/AutomationsApi.md#getautomationrun) | **GET** /api/v1/automations/{automationId}/runs/{runId} | Get one automation run
*AutomationsApi* | [**listAutomationRuns**](docs/Api/AutomationsApi.md#listautomationruns) | **GET** /api/v1/automations/{automationId}/runs | List one automation&#39;s runs
*AutomationsApi* | [**listAutomations**](docs/Api/AutomationsApi.md#listautomations) | **GET** /api/v1/automations | List automations
*AutomationsApi* | [**stopAutomation**](docs/Api/AutomationsApi.md#stopautomation) | **POST** /api/v1/automations/{automationId}/stop | Stop one automation
*AutomationsApi* | [**updateAutomation**](docs/Api/AutomationsApi.md#updateautomation) | **PATCH** /api/v1/automations/{automationId} | Update one automation
*BroadcastsApi* | [**cancelBroadcast**](docs/Api/BroadcastsApi.md#cancelbroadcast) | **POST** /api/v1/broadcasts/{broadcastId}/cancel | Cancel a broadcast
*BroadcastsApi* | [**createBroadcast**](docs/Api/BroadcastsApi.md#createbroadcast) | **POST** /api/v1/broadcasts | Create one broadcast
*BroadcastsApi* | [**deleteBroadcast**](docs/Api/BroadcastsApi.md#deletebroadcast) | **DELETE** /api/v1/broadcasts/{broadcastId} | Delete a broadcast
*BroadcastsApi* | [**getBroadcast**](docs/Api/BroadcastsApi.md#getbroadcast) | **GET** /api/v1/broadcasts/{broadcastId} | Get one broadcast
*BroadcastsApi* | [**listBroadcastClickedLinks**](docs/Api/BroadcastsApi.md#listbroadcastclickedlinks) | **GET** /api/v1/broadcasts/{broadcastId}/clicked-links | List one broadcast&#39;s clicked links
*BroadcastsApi* | [**listBroadcastRecipients**](docs/Api/BroadcastsApi.md#listbroadcastrecipients) | **GET** /api/v1/broadcasts/{broadcastId}/recipients | List one broadcast&#39;s recipients
*BroadcastsApi* | [**listBroadcasts**](docs/Api/BroadcastsApi.md#listbroadcasts) | **GET** /api/v1/broadcasts | List broadcasts
*BroadcastsApi* | [**pauseBroadcast**](docs/Api/BroadcastsApi.md#pausebroadcast) | **POST** /api/v1/broadcasts/{broadcastId}/pause | Pause a running broadcast
*BroadcastsApi* | [**resumeBroadcast**](docs/Api/BroadcastsApi.md#resumebroadcast) | **POST** /api/v1/broadcasts/{broadcastId}/resume | Resume a paused broadcast
*BroadcastsApi* | [**sendBroadcast**](docs/Api/BroadcastsApi.md#sendbroadcast) | **POST** /api/v1/broadcasts/{broadcastId}/send | Send or schedule a broadcast
*BroadcastsApi* | [**updateBroadcast**](docs/Api/BroadcastsApi.md#updatebroadcast) | **PATCH** /api/v1/broadcasts/{broadcastId} | Update a scheduled broadcast
*ContactPropertiesApi* | [**createContactProperty**](docs/Api/ContactPropertiesApi.md#createcontactproperty) | **POST** /api/v1/contact-properties | Create one contact property
*ContactPropertiesApi* | [**deleteContactProperty**](docs/Api/ContactPropertiesApi.md#deletecontactproperty) | **DELETE** /api/v1/contact-properties/{propertyId} | Delete one contact property
*ContactPropertiesApi* | [**getContactProperty**](docs/Api/ContactPropertiesApi.md#getcontactproperty) | **GET** /api/v1/contact-properties/{propertyId} | Get one contact property
*ContactPropertiesApi* | [**listContactProperties**](docs/Api/ContactPropertiesApi.md#listcontactproperties) | **GET** /api/v1/contact-properties | List contact properties
*ContactPropertiesApi* | [**updateContactProperty**](docs/Api/ContactPropertiesApi.md#updatecontactproperty) | **PATCH** /api/v1/contact-properties/{propertyId} | Update one contact property
*ContactsApi* | [**addContactToSegment**](docs/Api/ContactsApi.md#addcontacttosegment) | **POST** /api/v1/contacts/{contactId}/segments/{segmentId} | Add one contact to one segment
*ContactsApi* | [**createContactImport**](docs/Api/ContactsApi.md#createcontactimport) | **POST** /api/v1/contacts/imports | Import contacts from CSV
*ContactsApi* | [**createOrgContact**](docs/Api/ContactsApi.md#createorgcontact) | **POST** /api/v1/contacts | Create one contact
*ContactsApi* | [**deleteOrgContact**](docs/Api/ContactsApi.md#deleteorgcontact) | **DELETE** /api/v1/contacts/{contactId} | Delete one contact by ID or email
*ContactsApi* | [**getContactImport**](docs/Api/ContactsApi.md#getcontactimport) | **GET** /api/v1/contacts/imports/{importId} | Get one contact import
*ContactsApi* | [**getOrgContact**](docs/Api/ContactsApi.md#getorgcontact) | **GET** /api/v1/contacts/{contactId} | Get one contact by ID or email
*ContactsApi* | [**listContactImports**](docs/Api/ContactsApi.md#listcontactimports) | **GET** /api/v1/contacts/imports | List contact imports
*ContactsApi* | [**listContactSegments**](docs/Api/ContactsApi.md#listcontactsegments) | **GET** /api/v1/contacts/{contactId}/segments | List one contact&#39;s segments
*ContactsApi* | [**listContactTopics**](docs/Api/ContactsApi.md#listcontacttopics) | **GET** /api/v1/contacts/{contactId}/topics | List one contact&#39;s topics
*ContactsApi* | [**listOrgContacts**](docs/Api/ContactsApi.md#listorgcontacts) | **GET** /api/v1/contacts | List contacts
*ContactsApi* | [**removeContactFromSegment**](docs/Api/ContactsApi.md#removecontactfromsegment) | **DELETE** /api/v1/contacts/{contactId}/segments/{segmentId} | Remove one contact from one segment
*ContactsApi* | [**updateContactTopics**](docs/Api/ContactsApi.md#updatecontacttopics) | **PATCH** /api/v1/contacts/{contactId}/topics | Replace one contact&#39;s topic subscriptions
*ContactsApi* | [**updateOrgContact**](docs/Api/ContactsApi.md#updateorgcontact) | **PATCH** /api/v1/contacts/{contactId} | Update one contact by ID or email
*CustomEventsApi* | [**createEvent**](docs/Api/CustomEventsApi.md#createevent) | **POST** /api/v1/events | Define one custom event
*CustomEventsApi* | [**deleteEvent**](docs/Api/CustomEventsApi.md#deleteevent) | **DELETE** /api/v1/events/{identifier} | Delete one custom event
*CustomEventsApi* | [**getEvent**](docs/Api/CustomEventsApi.md#getevent) | **GET** /api/v1/events/{identifier} | Get one custom event
*CustomEventsApi* | [**listEvents**](docs/Api/CustomEventsApi.md#listevents) | **GET** /api/v1/events | List custom events
*CustomEventsApi* | [**sendEvent**](docs/Api/CustomEventsApi.md#sendevent) | **POST** /api/v1/events/send | Send one custom event
*CustomEventsApi* | [**updateEvent**](docs/Api/CustomEventsApi.md#updateevent) | **PATCH** /api/v1/events/{identifier} | Update one custom event
*EmailsApi* | [**cancelEmail**](docs/Api/EmailsApi.md#cancelemail) | **POST** /api/v1/emails/{emailId}/cancel | Cancel a queued email
*EmailsApi* | [**downloadAttachment**](docs/Api/EmailsApi.md#downloadattachment) | **GET** /api/v1/attachments/download | Download shared attachment bytes
*EmailsApi* | [**getEmail**](docs/Api/EmailsApi.md#getemail) | **GET** /api/v1/emails/{emailId} | Get one email
*EmailsApi* | [**getEmailAttachment**](docs/Api/EmailsApi.md#getemailattachment) | **GET** /api/v1/emails/{emailId}/attachments/{attachmentId} | Get one email attachment
*EmailsApi* | [**getEmailMetrics**](docs/Api/EmailsApi.md#getemailmetrics) | **GET** /api/v1/emails/metrics | Aggregate email metrics
*EmailsApi* | [**getReceivedEmail**](docs/Api/EmailsApi.md#getreceivedemail) | **GET** /api/v1/received-emails/{emailId} | Get one inbound email
*EmailsApi* | [**getReceivedEmailAttachment**](docs/Api/EmailsApi.md#getreceivedemailattachment) | **GET** /api/v1/received-emails/{emailId}/attachments/{attachmentId} | Get one inbound email attachment
*EmailsApi* | [**getSharedEmail**](docs/Api/EmailsApi.md#getsharedemail) | **GET** /api/v1/shared/{token} | Read a shared email
*EmailsApi* | [**listEmailAttachments**](docs/Api/EmailsApi.md#listemailattachments) | **GET** /api/v1/emails/{emailId}/attachments | List one email&#39;s attachments
*EmailsApi* | [**listEmails**](docs/Api/EmailsApi.md#listemails) | **GET** /api/v1/emails | List emails
*EmailsApi* | [**listReceivedEmailAttachments**](docs/Api/EmailsApi.md#listreceivedemailattachments) | **GET** /api/v1/received-emails/{emailId}/attachments | List one inbound email&#39;s attachments
*EmailsApi* | [**receiveInboundEmail**](docs/Api/EmailsApi.md#receiveinboundemail) | **POST** /api/v1/received-emails | Store one inbound email
*EmailsApi* | [**rescheduleEmail**](docs/Api/EmailsApi.md#rescheduleemail) | **PATCH** /api/v1/emails/{emailId} | Reschedule a queued email
*EmailsApi* | [**sendEmail**](docs/Api/EmailsApi.md#sendemail) | **POST** /api/v1/emails | Queue one email
*EmailsApi* | [**sendEmailBatch**](docs/Api/EmailsApi.md#sendemailbatch) | **POST** /api/v1/emails/batch | Queue one to 100 emails
*EmailsApi* | [**shareEmail**](docs/Api/EmailsApi.md#shareemail) | **POST** /api/v1/emails/{emailId}/share | Create a shareable link for one email
*EventsApi* | [**listEmailEvents**](docs/Api/EventsApi.md#listemailevents) | **GET** /api/v1/emails/{emailId}/events | List one email&#39;s events
*LogsApi* | [**getLog**](docs/Api/LogsApi.md#getlog) | **GET** /api/v1/logs/{logId} | Get one API request log
*LogsApi* | [**listLogs**](docs/Api/LogsApi.md#listlogs) | **GET** /api/v1/logs | List API request logs
*OpenTrackingApi* | [**getOpenTracking**](docs/Api/OpenTrackingApi.md#getopentracking) | **GET** /api/v1/open-tracking | Read organization open tracking
*OpenTrackingApi* | [**recordClick**](docs/Api/OpenTrackingApi.md#recordclick) | **GET** /c/{messageId}/{signature} | Follow a signed first-party click redirect
*OpenTrackingApi* | [**recordOpen**](docs/Api/OpenTrackingApi.md#recordopen) | **GET** /o/{messageId}/{signature}.gif | Fetch the signed first-party open pixel
*OpenTrackingApi* | [**updateOpenTracking**](docs/Api/OpenTrackingApi.md#updateopentracking) | **PATCH** /api/v1/open-tracking | Update organization open tracking
*OutboundProvidersApi* | [**getOutboundProviders**](docs/Api/OutboundProvidersApi.md#getoutboundproviders) | **GET** /api/v1/providers | Read outbound-provider routing
*OutboundProvidersApi* | [**ingestAwsSesEvent**](docs/Api/OutboundProvidersApi.md#ingestawssesevent) | **POST** /api/v1/providers/aws-ses/events | Ingest one Amazon SES event
*OutboundProvidersApi* | [**receiveAwsSesSnsEvent**](docs/Api/OutboundProvidersApi.md#receiveawssessnsevent) | **POST** /api/v1/providers/aws-ses/events/{orgId} | Receive one signed Amazon SNS notification
*OutboundProvidersApi* | [**testOutboundProvider**](docs/Api/OutboundProvidersApi.md#testoutboundprovider) | **POST** /api/v1/providers/test | Test one outbound provider
*OutboundProvidersApi* | [**updateOutboundProviders**](docs/Api/OutboundProvidersApi.md#updateoutboundproviders) | **PATCH** /api/v1/providers | Update outbound-provider routing
*RateLimitsApi* | [**getRateLimits**](docs/Api/RateLimitsApi.md#getratelimits) | **GET** /api/v1/rate-limits | Read organization send-rate limits
*RateLimitsApi* | [**updateRateLimits**](docs/Api/RateLimitsApi.md#updateratelimits) | **PATCH** /api/v1/rate-limits | Override organization send-rate limits
*SegmentsApi* | [**createSegment**](docs/Api/SegmentsApi.md#createsegment) | **POST** /api/v1/segments | Create one segment
*SegmentsApi* | [**deleteSegment**](docs/Api/SegmentsApi.md#deletesegment) | **DELETE** /api/v1/segments/{segmentId} | Delete one segment
*SegmentsApi* | [**getSegment**](docs/Api/SegmentsApi.md#getsegment) | **GET** /api/v1/segments/{segmentId} | Get one segment
*SegmentsApi* | [**listSegments**](docs/Api/SegmentsApi.md#listsegments) | **GET** /api/v1/segments | List segments
*SegmentsApi* | [**updateSegment**](docs/Api/SegmentsApi.md#updatesegment) | **PATCH** /api/v1/segments/{segmentId} | Update one segment
*SuppressionsApi* | [**createSuppression**](docs/Api/SuppressionsApi.md#createsuppression) | **POST** /api/v1/suppressions | Create one suppression
*SuppressionsApi* | [**deleteSuppression**](docs/Api/SuppressionsApi.md#deletesuppression) | **DELETE** /api/v1/suppressions/{suppressionId} | Delete one suppression
*SuppressionsApi* | [**getSuppression**](docs/Api/SuppressionsApi.md#getsuppression) | **GET** /api/v1/suppressions/{suppressionId} | Get one suppression
*SuppressionsApi* | [**importSuppressions**](docs/Api/SuppressionsApi.md#importsuppressions) | **POST** /api/v1/suppressions/import | Import suppressions from CSV
*SuppressionsApi* | [**listSuppressions**](docs/Api/SuppressionsApi.md#listsuppressions) | **GET** /api/v1/suppressions | List suppressions
*SuppressionsApi* | [**updateSuppression**](docs/Api/SuppressionsApi.md#updatesuppression) | **PATCH** /api/v1/suppressions/{suppressionId} | Update one suppression
*TemplatesApi* | [**createTemplate**](docs/Api/TemplatesApi.md#createtemplate) | **POST** /api/v1/templates | Create one template
*TemplatesApi* | [**deleteTemplate**](docs/Api/TemplatesApi.md#deletetemplate) | **DELETE** /api/v1/templates/{templateId} | Delete one template
*TemplatesApi* | [**duplicateTemplate**](docs/Api/TemplatesApi.md#duplicatetemplate) | **POST** /api/v1/templates/{templateId}/duplicate | Duplicate one template as a new draft
*TemplatesApi* | [**getTemplate**](docs/Api/TemplatesApi.md#gettemplate) | **GET** /api/v1/templates/{templateId} | Get one template
*TemplatesApi* | [**listTemplates**](docs/Api/TemplatesApi.md#listtemplates) | **GET** /api/v1/templates | List templates
*TemplatesApi* | [**previewTemplate**](docs/Api/TemplatesApi.md#previewtemplate) | **POST** /api/v1/templates/{templateId}/preview | Render one template without sending
*TemplatesApi* | [**publishTemplate**](docs/Api/TemplatesApi.md#publishtemplate) | **POST** /api/v1/templates/{templateId}/publish | Publish one template
*TemplatesApi* | [**updateTemplate**](docs/Api/TemplatesApi.md#updatetemplate) | **PATCH** /api/v1/templates/{templateId} | Update one template
*TopicsApi* | [**createTopic**](docs/Api/TopicsApi.md#createtopic) | **POST** /api/v1/topics | Create one topic
*TopicsApi* | [**deleteTopic**](docs/Api/TopicsApi.md#deletetopic) | **DELETE** /api/v1/topics/{topicId} | Delete one topic
*TopicsApi* | [**getTopic**](docs/Api/TopicsApi.md#gettopic) | **GET** /api/v1/topics/{topicId} | Get one topic
*TopicsApi* | [**listTopics**](docs/Api/TopicsApi.md#listtopics) | **GET** /api/v1/topics | List topics
*TopicsApi* | [**updateTopic**](docs/Api/TopicsApi.md#updatetopic) | **PATCH** /api/v1/topics/{topicId} | Update one topic
*WebhooksApi* | [**configureWebhook**](docs/Api/WebhooksApi.md#configurewebhook) | **PUT** /api/v1/webhooks | Configure webhook delivery
*WebhooksApi* | [**createWebhook**](docs/Api/WebhooksApi.md#createwebhook) | **POST** /api/v1/webhooks | Create one webhook
*WebhooksApi* | [**deleteWebhook**](docs/Api/WebhooksApi.md#deletewebhook) | **DELETE** /api/v1/webhooks/{webhookId} | Delete one webhook
*WebhooksApi* | [**getWebhookById**](docs/Api/WebhooksApi.md#getwebhookbyid) | **GET** /api/v1/webhooks/{webhookId} | Get one webhook
*WebhooksApi* | [**getWebhookEvent**](docs/Api/WebhooksApi.md#getwebhookevent) | **GET** /api/v1/webhooks/{webhookId}/events/{eventId} | Get one webhook event
*WebhooksApi* | [**listWebhookEventAttempts**](docs/Api/WebhooksApi.md#listwebhookeventattempts) | **GET** /api/v1/webhooks/{webhookId}/events/{eventId}/attempts | List one webhook event&#39;s attempts
*WebhooksApi* | [**listWebhookEvents**](docs/Api/WebhooksApi.md#listwebhookevents) | **GET** /api/v1/webhooks/{webhookId}/events | List one webhook&#39;s events
*WebhooksApi* | [**listWebhooks**](docs/Api/WebhooksApi.md#listwebhooks) | **GET** /api/v1/webhooks | List webhooks
*WebhooksApi* | [**replayWebhookEvent**](docs/Api/WebhooksApi.md#replaywebhookevent) | **POST** /api/v1/webhooks/{webhookId}/events/{eventId}/replay | Replay one webhook event
*WebhooksApi* | [**updateWebhook**](docs/Api/WebhooksApi.md#updatewebhook) | **PATCH** /api/v1/webhooks/{webhookId} | Update one webhook

## Models

- [ApiKey](docs/Model/ApiKey.md)
- [ApiKeyInput](docs/Model/ApiKeyInput.md)
- [ApiKeyListEnvelope](docs/Model/ApiKeyListEnvelope.md)
- [ApiKeySecret](docs/Model/ApiKeySecret.md)
- [ApiKeyUpdateInput](docs/Model/ApiKeyUpdateInput.md)
- [ApiLog](docs/Model/ApiLog.md)
- [ApiLogListEnvelope](docs/Model/ApiLogListEnvelope.md)
- [Audience](docs/Model/Audience.md)
- [AudienceInput](docs/Model/AudienceInput.md)
- [AudienceListEnvelope](docs/Model/AudienceListEnvelope.md)
- [Automation](docs/Model/Automation.md)
- [AutomationInput](docs/Model/AutomationInput.md)
- [AutomationListEnvelope](docs/Model/AutomationListEnvelope.md)
- [AutomationRun](docs/Model/AutomationRun.md)
- [AutomationRunListEnvelope](docs/Model/AutomationRunListEnvelope.md)
- [AutomationUpdateInput](docs/Model/AutomationUpdateInput.md)
- [AwsSnsEnvelope](docs/Model/AwsSnsEnvelope.md)
- [Broadcast](docs/Model/Broadcast.md)
- [BroadcastClickedLink](docs/Model/BroadcastClickedLink.md)
- [BroadcastClickedLinkListEnvelope](docs/Model/BroadcastClickedLinkListEnvelope.md)
- [BroadcastCreateInput](docs/Model/BroadcastCreateInput.md)
- [BroadcastEnvelope](docs/Model/BroadcastEnvelope.md)
- [BroadcastListEnvelope](docs/Model/BroadcastListEnvelope.md)
- [BroadcastProgress](docs/Model/BroadcastProgress.md)
- [BroadcastRecipient](docs/Model/BroadcastRecipient.md)
- [BroadcastRecipientListEnvelope](docs/Model/BroadcastRecipientListEnvelope.md)
- [BroadcastSendInput](docs/Model/BroadcastSendInput.md)
- [BroadcastUpdateInput](docs/Model/BroadcastUpdateInput.md)
- [Contact](docs/Model/Contact.md)
- [ContactImport](docs/Model/ContactImport.md)
- [ContactImportInput](docs/Model/ContactImportInput.md)
- [ContactImportListEnvelope](docs/Model/ContactImportListEnvelope.md)
- [ContactInput](docs/Model/ContactInput.md)
- [ContactListEnvelope](docs/Model/ContactListEnvelope.md)
- [ContactProperty](docs/Model/ContactProperty.md)
- [ContactPropertyInput](docs/Model/ContactPropertyInput.md)
- [ContactPropertyInputFallbackValue](docs/Model/ContactPropertyInputFallbackValue.md)
- [ContactPropertyListEnvelope](docs/Model/ContactPropertyListEnvelope.md)
- [ContactPropertyUpdateInput](docs/Model/ContactPropertyUpdateInput.md)
- [ContactSegmentListEnvelope](docs/Model/ContactSegmentListEnvelope.md)
- [ContactSegmentRef](docs/Model/ContactSegmentRef.md)
- [ContactTopicListEnvelope](docs/Model/ContactTopicListEnvelope.md)
- [ContactTopicRef](docs/Model/ContactTopicRef.md)
- [ContactTopicsUpdateInput](docs/Model/ContactTopicsUpdateInput.md)
- [CustomEvent](docs/Model/CustomEvent.md)
- [CustomEventInput](docs/Model/CustomEventInput.md)
- [CustomEventListEnvelope](docs/Model/CustomEventListEnvelope.md)
- [CustomEventUpdateInput](docs/Model/CustomEventUpdateInput.md)
- [DeletedResource](docs/Model/DeletedResource.md)
- [Email](docs/Model/Email.md)
- [EmailAttachment](docs/Model/EmailAttachment.md)
- [EmailBatchEnvelope](docs/Model/EmailBatchEnvelope.md)
- [EmailBatchItem](docs/Model/EmailBatchItem.md)
- [EmailListEnvelope](docs/Model/EmailListEnvelope.md)
- [EmailMetrics](docs/Model/EmailMetrics.md)
- [EmailMetricsDataInner](docs/Model/EmailMetricsDataInner.md)
- [EmailMetricsDataInnerDataInner](docs/Model/EmailMetricsDataInnerDataInner.md)
- [EmailSummary](docs/Model/EmailSummary.md)
- [EmailTag](docs/Model/EmailTag.md)
- [ErrorEnvelope](docs/Model/ErrorEnvelope.md)
- [ErrorEnvelopeError](docs/Model/ErrorEnvelopeError.md)
- [EventOccurrence](docs/Model/EventOccurrence.md)
- [EventOccurrenceEnvelope](docs/Model/EventOccurrenceEnvelope.md)
- [InlineEmailInput](docs/Model/InlineEmailInput.md)
- [InlineEmailInputAnyOf](docs/Model/InlineEmailInputAnyOf.md)
- [InlineEmailInputAnyOf1](docs/Model/InlineEmailInputAnyOf1.md)
- [ListEmailEvents200Response](docs/Model/ListEmailEvents200Response.md)
- [MessageEvent](docs/Model/MessageEvent.md)
- [MessageOutboundProvider](docs/Model/MessageOutboundProvider.md)
- [OpenTrackingSettings](docs/Model/OpenTrackingSettings.md)
- [OpenTrackingUpdateInput](docs/Model/OpenTrackingUpdateInput.md)
- [OrgContact](docs/Model/OrgContact.md)
- [OrgContactInput](docs/Model/OrgContactInput.md)
- [OrgContactInputSegmentsInner](docs/Model/OrgContactInputSegmentsInner.md)
- [OrgContactInputTopicsInner](docs/Model/OrgContactInputTopicsInner.md)
- [OrgContactListEnvelope](docs/Model/OrgContactListEnvelope.md)
- [OrgContactUpdateInput](docs/Model/OrgContactUpdateInput.md)
- [OutboundProvider](docs/Model/OutboundProvider.md)
- [OutboundProviderCapabilities](docs/Model/OutboundProviderCapabilities.md)
- [OutboundProviderConnectionDetails](docs/Model/OutboundProviderConnectionDetails.md)
- [OutboundProviderDomainOverrideInput](docs/Model/OutboundProviderDomainOverrideInput.md)
- [OutboundProviderDomainSetting](docs/Model/OutboundProviderDomainSetting.md)
- [OutboundProviderEventEnvelope](docs/Model/OutboundProviderEventEnvelope.md)
- [OutboundProviderEventResult](docs/Model/OutboundProviderEventResult.md)
- [OutboundProviderSettings](docs/Model/OutboundProviderSettings.md)
- [OutboundProviderStatus](docs/Model/OutboundProviderStatus.md)
- [OutboundProviderTestInput](docs/Model/OutboundProviderTestInput.md)
- [OutboundProviderTestResult](docs/Model/OutboundProviderTestResult.md)
- [OutboundProviderUpdateInput](docs/Model/OutboundProviderUpdateInput.md)
- [QueuedEmail](docs/Model/QueuedEmail.md)
- [RateLimitErrorEnvelope](docs/Model/RateLimitErrorEnvelope.md)
- [RateLimitErrorEnvelopeError](docs/Model/RateLimitErrorEnvelopeError.md)
- [RateLimitLane](docs/Model/RateLimitLane.md)
- [RateLimitSettings](docs/Model/RateLimitSettings.md)
- [RateLimitUpdateInput](docs/Model/RateLimitUpdateInput.md)
- [ReceiveInboundEmailInput](docs/Model/ReceiveInboundEmailInput.md)
- [ReceivedEmail](docs/Model/ReceivedEmail.md)
- [ReceivedEmailAccepted](docs/Model/ReceivedEmailAccepted.md)
- [ReceivedEmailDiscarded](docs/Model/ReceivedEmailDiscarded.md)
- [Recipients](docs/Model/Recipients.md)
- [RescheduleEmailInput](docs/Model/RescheduleEmailInput.md)
- [RetrievedEmailAttachment](docs/Model/RetrievedEmailAttachment.md)
- [RetrievedEmailAttachmentListEnvelope](docs/Model/RetrievedEmailAttachmentListEnvelope.md)
- [Segment](docs/Model/Segment.md)
- [SegmentInput](docs/Model/SegmentInput.md)
- [SegmentListEnvelope](docs/Model/SegmentListEnvelope.md)
- [SendEmailInput](docs/Model/SendEmailInput.md)
- [SendEventInput](docs/Model/SendEventInput.md)
- [ShareEmailInput](docs/Model/ShareEmailInput.md)
- [SharedEmail](docs/Model/SharedEmail.md)
- [SharedEmailContent](docs/Model/SharedEmailContent.md)
- [StoredAttachment](docs/Model/StoredAttachment.md)
- [Suppression](docs/Model/Suppression.md)
- [SuppressionInput](docs/Model/SuppressionInput.md)
- [SuppressionListEnvelope](docs/Model/SuppressionListEnvelope.md)
- [SuppressionReason](docs/Model/SuppressionReason.md)
- [SuppressionUpdateInput](docs/Model/SuppressionUpdateInput.md)
- [Template](docs/Model/Template.md)
- [TemplateEmailInput](docs/Model/TemplateEmailInput.md)
- [TemplateInput](docs/Model/TemplateInput.md)
- [TemplateListEnvelope](docs/Model/TemplateListEnvelope.md)
- [TemplatePreview](docs/Model/TemplatePreview.md)
- [TemplatePreviewInput](docs/Model/TemplatePreviewInput.md)
- [Topic](docs/Model/Topic.md)
- [TopicInput](docs/Model/TopicInput.md)
- [TopicListEnvelope](docs/Model/TopicListEnvelope.md)
- [TopicUpdateInput](docs/Model/TopicUpdateInput.md)
- [ValidationIssue](docs/Model/ValidationIssue.md)
- [Webhook](docs/Model/Webhook.md)
- [WebhookConfigurationEnvelope](docs/Model/WebhookConfigurationEnvelope.md)
- [WebhookConfigurationInput](docs/Model/WebhookConfigurationInput.md)
- [WebhookConfiguredEndpoint](docs/Model/WebhookConfiguredEndpoint.md)
- [WebhookCreateEnvelope](docs/Model/WebhookCreateEnvelope.md)
- [WebhookCreateInput](docs/Model/WebhookCreateInput.md)
- [WebhookDelivery](docs/Model/WebhookDelivery.md)
- [WebhookDeliveryAttempt](docs/Model/WebhookDeliveryAttempt.md)
- [WebhookDeliveryAttemptListEnvelope](docs/Model/WebhookDeliveryAttemptListEnvelope.md)
- [WebhookDeliveryListEnvelope](docs/Model/WebhookDeliveryListEnvelope.md)
- [WebhookEndpoint](docs/Model/WebhookEndpoint.md)
- [WebhookEvent](docs/Model/WebhookEvent.md)
- [WebhookEventData](docs/Model/WebhookEventData.md)
- [WebhookListEnvelope](docs/Model/WebhookListEnvelope.md)
- [WebhookReadEnvelope](docs/Model/WebhookReadEnvelope.md)
- [WebhookUpdateInput](docs/Model/WebhookUpdateInput.md)

## Authorization

Authentication schemes defined for the API:
### bearerAuth

- **Type**: Bearer authentication (pb_live_... or pb_test_...)

## Tests

To run the tests, use:

```bash
composer install
vendor/bin/phpunit
```

## Author



## About this package

This PHP package is automatically generated by the [OpenAPI Generator](https://openapi-generator.tech) project:

- API version: `1.0.0`
    - Generator version: `7.24.0`
- Build package: `org.openapitools.codegen.languages.PhpClientCodegen`
