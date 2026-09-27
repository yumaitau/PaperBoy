/* tslint:disable */
/* eslint-disable */
/**
 * 
 * @export
 * @interface ApiKey
 */
export interface ApiKey {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof ApiKey
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    display: string | null;
    /**
     * 
     * @type {ApiKeyEnvironmentEnum}
     * @memberof ApiKey
     */
    environment: ApiKeyEnvironmentEnum;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    key_id: string;
    /**
     * 
     * @type {any}
     * @memberof ApiKey
     */
    last_used_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof ApiKey
     */
    name: string;
    /**
     * 
     * @type {any}
     * @memberof ApiKey
     */
    revoked_at: any | null;
    /**
     * Granted organization permissions. Null grants the creator role's full permissions.
     * @type {Array<string>}
     * @memberof ApiKey
     */
    scopes: Array<string> | null;
}


/**
 * @export
 */
export const ApiKeyEnvironmentEnum = {
    live: 'live',
    test: 'test'
} as const;
export type ApiKeyEnvironmentEnum = typeof ApiKeyEnvironmentEnum[keyof typeof ApiKeyEnvironmentEnum];

/**
 * 
 * @export
 * @interface ApiKeyInput
 */
export interface ApiKeyInput {
    /**
     * 
     * @type {ApiKeyInputEnvironmentEnum}
     * @memberof ApiKeyInput
     */
    environment?: ApiKeyInputEnvironmentEnum;
    /**
     * 
     * @type {string}
     * @memberof ApiKeyInput
     */
    name: string;
    /**
     * Subset of the creator role's permissions. Omit for full role access.
     * @type {Array<string>}
     * @memberof ApiKeyInput
     */
    scopes?: Array<string> | null;
}


/**
 * @export
 */
export const ApiKeyInputEnvironmentEnum = {
    live: 'live',
    test: 'test'
} as const;
export type ApiKeyInputEnvironmentEnum = typeof ApiKeyInputEnvironmentEnum[keyof typeof ApiKeyInputEnvironmentEnum];

/**
 * 
 * @export
 * @interface ApiKeyListEnvelope
 */
export interface ApiKeyListEnvelope {
    /**
     * 
     * @type {Array<ApiKey>}
     * @memberof ApiKeyListEnvelope
     */
    data: Array<ApiKey>;
}
/**
 * 
 * @export
 * @interface ApiKeySecret
 */
export interface ApiKeySecret {
    /**
     * 
     * @type {string}
     * @memberof ApiKeySecret
     */
    display: string;
    /**
     * 
     * @type {ApiKeySecretEnvironmentEnum}
     * @memberof ApiKeySecret
     */
    environment: ApiKeySecretEnvironmentEnum;
    /**
     * 
     * @type {string}
     * @memberof ApiKeySecret
     */
    id: string;
    /**
     * Raw bearer secret. Shown only once.
     * @type {string}
     * @memberof ApiKeySecret
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof ApiKeySecret
     */
    name: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof ApiKeySecret
     */
    scopes: Array<string> | null;
}


/**
 * @export
 */
export const ApiKeySecretEnvironmentEnum = {
    live: 'live',
    test: 'test'
} as const;
export type ApiKeySecretEnvironmentEnum = typeof ApiKeySecretEnvironmentEnum[keyof typeof ApiKeySecretEnvironmentEnum];

/**
 * 
 * @export
 * @interface ApiKeyUpdateInput
 */
export interface ApiKeyUpdateInput {
    /**
     * 
     * @type {string}
     * @memberof ApiKeyUpdateInput
     */
    name?: string;
    /**
     * Replacement scope list, or null to restore full role access.
     * @type {Array<string>}
     * @memberof ApiKeyUpdateInput
     */
    scopes?: Array<string> | null;
}
/**
 * 
 * @export
 * @interface ApiLog
 */
export interface ApiLog {
    /**
     * 
     * @type {string}
     * @memberof ApiLog
     */
    api_key_id: string | null;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof ApiLog
     */
    created_at: string;
    /**
     * 
     * @type {number}
     * @memberof ApiLog
     */
    duration_ms: number;
    /**
     * 
     * @type {string}
     * @memberof ApiLog
     */
    environment: string | null;
    /**
     * 
     * @type {string}
     * @memberof ApiLog
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ApiLog
     */
    method: string;
    /**
     * 
     * @type {ApiLogObjectEnum}
     * @memberof ApiLog
     */
    object: ApiLogObjectEnum;
    /**
     * 
     * @type {string}
     * @memberof ApiLog
     */
    path: string;
    /**
     * 
     * @type {number}
     * @memberof ApiLog
     */
    response_status: number;
    /**
     * 
     * @type {string}
     * @memberof ApiLog
     */
    user_agent: string | null;
}


/**
 * @export
 */
export const ApiLogObjectEnum = {
    log: 'log'
} as const;
export type ApiLogObjectEnum = typeof ApiLogObjectEnum[keyof typeof ApiLogObjectEnum];

/**
 * 
 * @export
 * @interface ApiLogListEnvelope
 */
export interface ApiLogListEnvelope {
    /**
     * 
     * @type {Array<ApiLog>}
     * @memberof ApiLogListEnvelope
     */
    data: Array<ApiLog>;
    /**
     * 
     * @type {ApiLogListEnvelopeObjectEnum}
     * @memberof ApiLogListEnvelope
     */
    object: ApiLogListEnvelopeObjectEnum;
}


/**
 * @export
 */
export const ApiLogListEnvelopeObjectEnum = {
    list: 'list'
} as const;
export type ApiLogListEnvelopeObjectEnum = typeof ApiLogListEnvelopeObjectEnum[keyof typeof ApiLogListEnvelopeObjectEnum];

/**
 * 
 * @export
 * @interface Audience
 */
export interface Audience {
    /**
     * 
     * @type {number}
     * @memberof Audience
     */
    active_contact_count: number;
    /**
     * 
     * @type {number}
     * @memberof Audience
     */
    contact_count: number;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Audience
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Audience
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Audience
     */
    name: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Audience
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface AudienceInput
 */
export interface AudienceInput {
    /**
     * 
     * @type {string}
     * @memberof AudienceInput
     */
    name: string;
}
/**
 * 
 * @export
 * @interface AudienceListEnvelope
 */
export interface AudienceListEnvelope {
    /**
     * 
     * @type {Array<Audience>}
     * @memberof AudienceListEnvelope
     */
    data: Array<Audience>;
    /**
     * 
     * @type {AudienceListEnvelopeProtocolTimeZoneEnum}
     * @memberof AudienceListEnvelope
     */
    protocol_time_zone: AudienceListEnvelopeProtocolTimeZoneEnum;
}


/**
 * @export
 */
export const AudienceListEnvelopeProtocolTimeZoneEnum = {
    UTC: 'UTC'
} as const;
export type AudienceListEnvelopeProtocolTimeZoneEnum = typeof AudienceListEnvelopeProtocolTimeZoneEnum[keyof typeof AudienceListEnvelopeProtocolTimeZoneEnum];

/**
 * 
 * @export
 * @interface Automation
 */
export interface Automation {
    /**
     * 
     * @type {Array<any>}
     * @memberof Automation
     */
    connections: Array<any>;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Automation
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Automation
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Automation
     */
    name: string;
    /**
     * 
     * @type {AutomationStatusEnum}
     * @memberof Automation
     */
    status: AutomationStatusEnum;
    /**
     * 
     * @type {Array<any>}
     * @memberof Automation
     */
    steps: Array<any>;
    /**
     * 
     * @type {string}
     * @memberof Automation
     */
    trigger_event: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Automation
     */
    updated_at: string;
}


/**
 * @export
 */
export const AutomationStatusEnum = {
    enabled: 'enabled',
    disabled: 'disabled'
} as const;
export type AutomationStatusEnum = typeof AutomationStatusEnum[keyof typeof AutomationStatusEnum];

/**
 * 
 * @export
 * @interface AutomationInput
 */
export interface AutomationInput {
    /**
     * 
     * @type {Array<any>}
     * @memberof AutomationInput
     */
    connections?: Array<any>;
    /**
     * 
     * @type {string}
     * @memberof AutomationInput
     */
    name: string;
    /**
     * 
     * @type {AutomationInputStatusEnum}
     * @memberof AutomationInput
     */
    status?: AutomationInputStatusEnum;
    /**
     * 
     * @type {Array<any>}
     * @memberof AutomationInput
     */
    steps: Array<any>;
}


/**
 * @export
 */
export const AutomationInputStatusEnum = {
    enabled: 'enabled',
    disabled: 'disabled'
} as const;
export type AutomationInputStatusEnum = typeof AutomationInputStatusEnum[keyof typeof AutomationInputStatusEnum];

/**
 * 
 * @export
 * @interface AutomationListEnvelope
 */
export interface AutomationListEnvelope {
    /**
     * 
     * @type {Array<Automation>}
     * @memberof AutomationListEnvelope
     */
    data: Array<Automation>;
}
/**
 * 
 * @export
 * @interface AutomationRun
 */
export interface AutomationRun {
    /**
     * 
     * @type {string}
     * @memberof AutomationRun
     */
    automation_id: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof AutomationRun
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof AutomationRun
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof AutomationRun
     */
    occurrence_id: string | null;
    /**
     * 
     * @type {AutomationRunStatusEnum}
     * @memberof AutomationRun
     */
    status: AutomationRunStatusEnum;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof AutomationRun
     */
    updated_at: string;
}


/**
 * @export
 */
export const AutomationRunStatusEnum = {
    completed: 'completed',
    failed: 'failed'
} as const;
export type AutomationRunStatusEnum = typeof AutomationRunStatusEnum[keyof typeof AutomationRunStatusEnum];

/**
 * 
 * @export
 * @interface AutomationRunListEnvelope
 */
export interface AutomationRunListEnvelope {
    /**
     * 
     * @type {Array<AutomationRun>}
     * @memberof AutomationRunListEnvelope
     */
    data: Array<AutomationRun>;
}
/**
 * 
 * @export
 * @interface AutomationUpdateInput
 */
export interface AutomationUpdateInput {
    /**
     * 
     * @type {Array<any>}
     * @memberof AutomationUpdateInput
     */
    connections?: Array<any>;
    /**
     * 
     * @type {string}
     * @memberof AutomationUpdateInput
     */
    name?: string;
    /**
     * 
     * @type {AutomationUpdateInputStatusEnum}
     * @memberof AutomationUpdateInput
     */
    status?: AutomationUpdateInputStatusEnum;
    /**
     * 
     * @type {Array<any>}
     * @memberof AutomationUpdateInput
     */
    steps?: Array<any>;
}


/**
 * @export
 */
export const AutomationUpdateInputStatusEnum = {
    enabled: 'enabled',
    disabled: 'disabled'
} as const;
export type AutomationUpdateInputStatusEnum = typeof AutomationUpdateInputStatusEnum[keyof typeof AutomationUpdateInputStatusEnum];

/**
 * 
 * @export
 * @interface AwsSnsEnvelope
 */
export interface AwsSnsEnvelope {
    [key: string]: any | any;
    /**
     * 
     * @type {string}
     * @memberof AwsSnsEnvelope
     */
    Message: string;
    /**
     * 
     * @type {string}
     * @memberof AwsSnsEnvelope
     */
    MessageId: string;
    /**
     * 
     * @type {string}
     * @memberof AwsSnsEnvelope
     */
    Signature: string;
    /**
     * 
     * @type {AwsSnsEnvelopeSignatureVersionEnum}
     * @memberof AwsSnsEnvelope
     */
    SignatureVersion: AwsSnsEnvelopeSignatureVersionEnum;
    /**
     * 
     * @type {string}
     * @memberof AwsSnsEnvelope
     */
    SigningCertURL: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof AwsSnsEnvelope
     */
    Timestamp: string;
    /**
     * 
     * @type {string}
     * @memberof AwsSnsEnvelope
     */
    TopicArn: string;
    /**
     * 
     * @type {AwsSnsEnvelopeTypeEnum}
     * @memberof AwsSnsEnvelope
     */
    Type: AwsSnsEnvelopeTypeEnum;
}


/**
 * @export
 */
export const AwsSnsEnvelopeSignatureVersionEnum = {
    _1: '1',
    _2: '2'
} as const;
export type AwsSnsEnvelopeSignatureVersionEnum = typeof AwsSnsEnvelopeSignatureVersionEnum[keyof typeof AwsSnsEnvelopeSignatureVersionEnum];

/**
 * @export
 */
export const AwsSnsEnvelopeTypeEnum = {
    Notification: 'Notification',
    SubscriptionConfirmation: 'SubscriptionConfirmation',
    UnsubscribeConfirmation: 'UnsubscribeConfirmation'
} as const;
export type AwsSnsEnvelopeTypeEnum = typeof AwsSnsEnvelopeTypeEnum[keyof typeof AwsSnsEnvelopeTypeEnum];

/**
 * 
 * @export
 * @interface Broadcast
 */
export interface Broadcast {
    /**
     * 
     * @type {any}
     * @memberof Broadcast
     */
    cancelled_at: any | null;
    /**
     * 
     * @type {any}
     * @memberof Broadcast
     */
    completed_at: any | null;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Broadcast
     */
    created_at: string;
    /**
     * 
     * @type {BroadcastEnvironmentEnum}
     * @memberof Broadcast
     */
    environment: BroadcastEnvironmentEnum;
    /**
     * 
     * @type {string}
     * @memberof Broadcast
     */
    from: string;
    /**
     * 
     * @type {string}
     * @memberof Broadcast
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Broadcast
     */
    name: string;
    /**
     * 
     * @type {any}
     * @memberof Broadcast
     */
    paused_at: any | null;
    /**
     * 
     * @type {BroadcastProgress}
     * @memberof Broadcast
     */
    progress: BroadcastProgress;
    /**
     * 
     * @type {any}
     * @memberof Broadcast
     */
    scheduled_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof Broadcast
     */
    source_audience_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Broadcast
     */
    source_template_id: string | null;
    /**
     * 
     * @type {BroadcastStatusEnum}
     * @memberof Broadcast
     */
    status: BroadcastStatusEnum;
    /**
     * 
     * @type {string}
     * @memberof Broadcast
     */
    subject: string;
    /**
     * 
     * @type {string}
     * @memberof Broadcast
     */
    template_name: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Broadcast
     */
    updated_at: string;
}


/**
 * @export
 */
export const BroadcastEnvironmentEnum = {
    live: 'live',
    test: 'test'
} as const;
export type BroadcastEnvironmentEnum = typeof BroadcastEnvironmentEnum[keyof typeof BroadcastEnvironmentEnum];

/**
 * @export
 */
export const BroadcastStatusEnum = {
    scheduled: 'scheduled',
    running: 'running',
    paused: 'paused',
    completed: 'completed',
    cancelled: 'cancelled'
} as const;
export type BroadcastStatusEnum = typeof BroadcastStatusEnum[keyof typeof BroadcastStatusEnum];

/**
 * 
 * @export
 * @interface BroadcastClickedLink
 */
export interface BroadcastClickedLink {
    /**
     * 
     * @type {number}
     * @memberof BroadcastClickedLink
     */
    click_count: number;
    /**
     * 
     * @type {number}
     * @memberof BroadcastClickedLink
     */
    unique_clicks: number;
    /**
     * 
     * @type {string}
     * @memberof BroadcastClickedLink
     */
    url: string;
}
/**
 * 
 * @export
 * @interface BroadcastClickedLinkListEnvelope
 */
export interface BroadcastClickedLinkListEnvelope {
    /**
     * 
     * @type {Array<BroadcastClickedLink>}
     * @memberof BroadcastClickedLinkListEnvelope
     */
    data: Array<BroadcastClickedLink>;
}
/**
 * 
 * @export
 * @interface BroadcastCreateInput
 */
export interface BroadcastCreateInput {
    /**
     * 
     * @type {string}
     * @memberof BroadcastCreateInput
     */
    audience_id: string;
    /**
     * 
     * @type {string}
     * @memberof BroadcastCreateInput
     */
    from: string;
    /**
     * 
     * @type {string}
     * @memberof BroadcastCreateInput
     */
    name: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof BroadcastCreateInput
     */
    scheduled_for?: string;
    /**
     * 
     * @type {string}
     * @memberof BroadcastCreateInput
     */
    template_id: string;
}
/**
 * 
 * @export
 * @interface BroadcastEnvelope
 */
export interface BroadcastEnvelope {
    /**
     * 
     * @type {Broadcast}
     * @memberof BroadcastEnvelope
     */
    data: Broadcast;
}
/**
 * 
 * @export
 * @interface BroadcastListEnvelope
 */
export interface BroadcastListEnvelope {
    /**
     * 
     * @type {Array<Broadcast>}
     * @memberof BroadcastListEnvelope
     */
    data: Array<Broadcast>;
}
/**
 * 
 * @export
 * @interface BroadcastProgress
 */
export interface BroadcastProgress {
    /**
     * 
     * @type {number}
     * @memberof BroadcastProgress
     */
    cancelled: number;
    /**
     * 
     * @type {number}
     * @memberof BroadcastProgress
     */
    failed: number;
    /**
     * 
     * @type {number}
     * @memberof BroadcastProgress
     */
    pending: number;
    /**
     * 
     * @type {number}
     * @memberof BroadcastProgress
     */
    processing: number;
    /**
     * 
     * @type {number}
     * @memberof BroadcastProgress
     */
    queued: number;
    /**
     * 
     * @type {number}
     * @memberof BroadcastProgress
     */
    suppressed: number;
    /**
     * 
     * @type {number}
     * @memberof BroadcastProgress
     */
    total: number;
}
/**
 * 
 * @export
 * @interface BroadcastRecipient
 */
export interface BroadcastRecipient {
    /**
     * 
     * @type {any}
     * @memberof BroadcastRecipient
     */
    bounced_at: any | null;
    /**
     * 
     * @type {any}
     * @memberof BroadcastRecipient
     */
    clicked_at: any | null;
    /**
     * 
     * @type {any}
     * @memberof BroadcastRecipient
     */
    complained_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof BroadcastRecipient
     */
    contact_id: string | null;
    /**
     * 
     * @type {any}
     * @memberof BroadcastRecipient
     */
    delivered_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof BroadcastRecipient
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof BroadcastRecipient
     */
    message_id: string | null;
    /**
     * 
     * @type {any}
     * @memberof BroadcastRecipient
     */
    opened_at: any | null;
    /**
     * 
     * @type {number}
     * @memberof BroadcastRecipient
     */
    position: number;
    /**
     * 
     * @type {any}
     * @memberof BroadcastRecipient
     */
    sent_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof BroadcastRecipient
     */
    status: string;
    /**
     * 
     * @type {boolean}
     * @memberof BroadcastRecipient
     */
    unsubscribed: boolean;
}
/**
 * 
 * @export
 * @interface BroadcastRecipientListEnvelope
 */
export interface BroadcastRecipientListEnvelope {
    /**
     * 
     * @type {Array<BroadcastRecipient>}
     * @memberof BroadcastRecipientListEnvelope
     */
    data: Array<BroadcastRecipient>;
}
/**
 * 
 * @export
 * @interface BroadcastSendInput
 */
export interface BroadcastSendInput {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof BroadcastSendInput
     */
    scheduled_at?: string;
}
/**
 * 
 * @export
 * @interface BroadcastUpdateInput
 */
export interface BroadcastUpdateInput {
    /**
     * 
     * @type {string}
     * @memberof BroadcastUpdateInput
     */
    audience_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BroadcastUpdateInput
     */
    from?: string;
    /**
     * 
     * @type {string}
     * @memberof BroadcastUpdateInput
     */
    html?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BroadcastUpdateInput
     */
    name?: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof BroadcastUpdateInput
     */
    scheduled_for?: string;
    /**
     * 
     * @type {string}
     * @memberof BroadcastUpdateInput
     */
    subject?: string;
    /**
     * 
     * @type {string}
     * @memberof BroadcastUpdateInput
     */
    template_id?: string;
}
/**
 * 
 * @export
 * @interface Contact
 */
export interface Contact {
    /**
     * 
     * @type {string}
     * @memberof Contact
     */
    audience_id: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Contact
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Contact
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof Contact
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Contact
     */
    name: string | null;
    /**
     * 
     * @type {any}
     * @memberof Contact
     */
    unsubscribed_at: any | null;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Contact
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface ContactImport
 */
export interface ContactImport {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof ContactImport
     */
    created_at: string;
    /**
     * 
     * @type {number}
     * @memberof ContactImport
     */
    created_rows: number;
    /**
     * 
     * @type {string}
     * @memberof ContactImport
     */
    error: string | null;
    /**
     * 
     * @type {string}
     * @memberof ContactImport
     */
    file_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof ContactImport
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof ContactImport
     */
    skipped_rows: number;
    /**
     * 
     * @type {ContactImportStatusEnum}
     * @memberof ContactImport
     */
    status: ContactImportStatusEnum;
    /**
     * 
     * @type {number}
     * @memberof ContactImport
     */
    total_rows: number;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof ContactImport
     */
    updated_at: string;
    /**
     * 
     * @type {number}
     * @memberof ContactImport
     */
    updated_rows: number;
}


/**
 * @export
 */
export const ContactImportStatusEnum = {
    queued: 'queued',
    in_progress: 'in_progress',
    completed: 'completed',
    failed: 'failed'
} as const;
export type ContactImportStatusEnum = typeof ContactImportStatusEnum[keyof typeof ContactImportStatusEnum];

/**
 * 
 * @export
 * @interface ContactImportInput
 */
export interface ContactImportInput {
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof ContactImportInput
     */
    column_map?: { [key: string]: string; };
    /**
     * 
     * @type {string}
     * @memberof ContactImportInput
     */
    csv: string;
    /**
     * 
     * @type {string}
     * @memberof ContactImportInput
     */
    file_name?: string | null;
    /**
     * 
     * @type {ContactImportInputOnConflictEnum}
     * @memberof ContactImportInput
     */
    on_conflict?: ContactImportInputOnConflictEnum;
    /**
     * 
     * @type {Array<OrgContactInputSegmentsInner>}
     * @memberof ContactImportInput
     */
    segments?: Array<OrgContactInputSegmentsInner>;
    /**
     * 
     * @type {Array<OrgContactInputTopicsInner>}
     * @memberof ContactImportInput
     */
    topics?: Array<OrgContactInputTopicsInner>;
}


/**
 * @export
 */
export const ContactImportInputOnConflictEnum = {
    skip: 'skip',
    upsert: 'upsert'
} as const;
export type ContactImportInputOnConflictEnum = typeof ContactImportInputOnConflictEnum[keyof typeof ContactImportInputOnConflictEnum];

/**
 * 
 * @export
 * @interface ContactImportListEnvelope
 */
export interface ContactImportListEnvelope {
    /**
     * 
     * @type {Array<ContactImport>}
     * @memberof ContactImportListEnvelope
     */
    data: Array<ContactImport>;
}
/**
 * 
 * @export
 * @interface ContactInput
 */
export interface ContactInput {
    /**
     * 
     * @type {string}
     * @memberof ContactInput
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof ContactInput
     */
    name?: string | null;
}
/**
 * 
 * @export
 * @interface ContactListEnvelope
 */
export interface ContactListEnvelope {
    /**
     * 
     * @type {Array<Contact>}
     * @memberof ContactListEnvelope
     */
    data: Array<Contact>;
    /**
     * 
     * @type {ContactListEnvelopeProtocolTimeZoneEnum}
     * @memberof ContactListEnvelope
     */
    protocol_time_zone: ContactListEnvelopeProtocolTimeZoneEnum;
}


/**
 * @export
 */
export const ContactListEnvelopeProtocolTimeZoneEnum = {
    UTC: 'UTC'
} as const;
export type ContactListEnvelopeProtocolTimeZoneEnum = typeof ContactListEnvelopeProtocolTimeZoneEnum[keyof typeof ContactListEnvelopeProtocolTimeZoneEnum];

/**
 * 
 * @export
 * @interface ContactProperty
 */
export interface ContactProperty {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof ContactProperty
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ContactProperty
     */
    fallback_value: string | null;
    /**
     * 
     * @type {string}
     * @memberof ContactProperty
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ContactProperty
     */
    key: string;
    /**
     * 
     * @type {ContactPropertyTypeEnum}
     * @memberof ContactProperty
     */
    type: ContactPropertyTypeEnum;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof ContactProperty
     */
    updated_at: string;
}


/**
 * @export
 */
export const ContactPropertyTypeEnum = {
    string: 'string',
    number: 'number'
} as const;
export type ContactPropertyTypeEnum = typeof ContactPropertyTypeEnum[keyof typeof ContactPropertyTypeEnum];

/**
 * 
 * @export
 * @interface ContactPropertyInput
 */
export interface ContactPropertyInput {
    /**
     * 
     * @type {ContactPropertyInputFallbackValue}
     * @memberof ContactPropertyInput
     */
    fallback_value?: ContactPropertyInputFallbackValue | null;
    /**
     * 
     * @type {string}
     * @memberof ContactPropertyInput
     */
    key: string;
    /**
     * 
     * @type {ContactPropertyInputTypeEnum}
     * @memberof ContactPropertyInput
     */
    type: ContactPropertyInputTypeEnum;
}


/**
 * @export
 */
export const ContactPropertyInputTypeEnum = {
    string: 'string',
    number: 'number'
} as const;
export type ContactPropertyInputTypeEnum = typeof ContactPropertyInputTypeEnum[keyof typeof ContactPropertyInputTypeEnum];

/**
 * 
 * @export
 * @interface ContactPropertyInputFallbackValue
 */
export interface ContactPropertyInputFallbackValue {
}
/**
 * 
 * @export
 * @interface ContactPropertyListEnvelope
 */
export interface ContactPropertyListEnvelope {
    /**
     * 
     * @type {Array<ContactProperty>}
     * @memberof ContactPropertyListEnvelope
     */
    data: Array<ContactProperty>;
}
/**
 * 
 * @export
 * @interface ContactPropertyUpdateInput
 */
export interface ContactPropertyUpdateInput {
    /**
     * 
     * @type {ContactPropertyInputFallbackValue}
     * @memberof ContactPropertyUpdateInput
     */
    fallback_value?: ContactPropertyInputFallbackValue | null;
}
/**
 * 
 * @export
 * @interface ContactSegmentListEnvelope
 */
export interface ContactSegmentListEnvelope {
    /**
     * 
     * @type {Array<ContactSegmentRef>}
     * @memberof ContactSegmentListEnvelope
     */
    data: Array<ContactSegmentRef>;
}
/**
 * 
 * @export
 * @interface ContactSegmentRef
 */
export interface ContactSegmentRef {
    /**
     * 
     * @type {string}
     * @memberof ContactSegmentRef
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ContactSegmentRef
     */
    name: string;
}
/**
 * 
 * @export
 * @interface ContactTopicListEnvelope
 */
export interface ContactTopicListEnvelope {
    /**
     * 
     * @type {Array<ContactTopicRef>}
     * @memberof ContactTopicListEnvelope
     */
    data: Array<ContactTopicRef>;
}
/**
 * 
 * @export
 * @interface ContactTopicRef
 */
export interface ContactTopicRef {
    /**
     * 
     * @type {string}
     * @memberof ContactTopicRef
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ContactTopicRef
     */
    name: string;
    /**
     * 
     * @type {ContactTopicRefSubscriptionEnum}
     * @memberof ContactTopicRef
     */
    subscription: ContactTopicRefSubscriptionEnum;
}


/**
 * @export
 */
export const ContactTopicRefSubscriptionEnum = {
    opt_in: 'opt_in',
    opt_out: 'opt_out'
} as const;
export type ContactTopicRefSubscriptionEnum = typeof ContactTopicRefSubscriptionEnum[keyof typeof ContactTopicRefSubscriptionEnum];

/**
 * 
 * @export
 * @interface ContactTopicsUpdateInput
 */
export interface ContactTopicsUpdateInput {
    /**
     * 
     * @type {Array<OrgContactInputTopicsInner>}
     * @memberof ContactTopicsUpdateInput
     */
    topics: Array<OrgContactInputTopicsInner>;
}
/**
 * 
 * @export
 * @interface CustomEvent
 */
export interface CustomEvent {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof CustomEvent
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomEvent
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomEvent
     */
    name: string;
    /**
     * 
     * @type {CustomEventObjectEnum}
     * @memberof CustomEvent
     */
    object: CustomEventObjectEnum;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof CustomEvent
     */
    schema: { [key: string]: string; };
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof CustomEvent
     */
    updated_at: string;
}


/**
 * @export
 */
export const CustomEventObjectEnum = {
    event: 'event'
} as const;
export type CustomEventObjectEnum = typeof CustomEventObjectEnum[keyof typeof CustomEventObjectEnum];

/**
 * 
 * @export
 * @interface CustomEventInput
 */
export interface CustomEventInput {
    /**
     * 
     * @type {string}
     * @memberof CustomEventInput
     */
    name: string;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof CustomEventInput
     */
    schema?: { [key: string]: string; };
}
/**
 * 
 * @export
 * @interface CustomEventListEnvelope
 */
export interface CustomEventListEnvelope {
    /**
     * 
     * @type {Array<CustomEvent>}
     * @memberof CustomEventListEnvelope
     */
    data: Array<CustomEvent>;
}
/**
 * 
 * @export
 * @interface CustomEventUpdateInput
 */
export interface CustomEventUpdateInput {
    /**
     * 
     * @type {string}
     * @memberof CustomEventUpdateInput
     */
    name?: string;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof CustomEventUpdateInput
     */
    schema?: { [key: string]: string; };
}
/**
 * 
 * @export
 * @interface DeletedResource
 */
export interface DeletedResource {
    /**
     * 
     * @type {DeletedResourceDeletedEnum}
     * @memberof DeletedResource
     */
    deleted: DeletedResourceDeletedEnum;
    /**
     * 
     * @type {string}
     * @memberof DeletedResource
     */
    id: string;
}


/**
 * @export
 */
export const DeletedResourceDeletedEnum = {
    true: true
} as const;
export type DeletedResourceDeletedEnum = typeof DeletedResourceDeletedEnum[keyof typeof DeletedResourceDeletedEnum];

/**
 * 
 * @export
 * @interface Email
 */
export interface Email {
    /**
     * 
     * @type {Array<StoredAttachment>}
     * @memberof Email
     */
    attachments: Array<StoredAttachment>;
    /**
     * 
     * @type {number}
     * @memberof Email
     */
    attempt_count: number;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Email
     */
    created_at: string;
    /**
     * 
     * @type {EmailDeliveryModeEnum}
     * @memberof Email
     */
    delivery_mode: EmailDeliveryModeEnum;
    /**
     * 
     * @type {string}
     * @memberof Email
     */
    domain_id: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof Email
     */
    cc: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof Email
     */
    bcc: Array<string>;
    /**
     * Custom MIME headers. Delivery headers such as From, To, Cc, Bcc, Subject, and Date are reserved.
     * @type {{ [key: string]: string; }}
     * @memberof Email
     */
    headers: { [key: string]: string; };
    /**
     * 
     * @type {EmailEnvironmentEnum}
     * @memberof Email
     */
    environment: EmailEnvironmentEnum;
    /**
     * 
     * @type {any}
     * @memberof Email
     */
    failed_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof Email
     */
    failure_reason: string | null;
    /**
     * 
     * @type {string}
     * @memberof Email
     */
    from: string;
    /**
     * 
     * @type {string}
     * @memberof Email
     */
    html: string | null;
    /**
     * 
     * @type {string}
     * @memberof Email
     */
    id: string;
    /**
     * 
     * @type {any}
     * @memberof Email
     */
    last_attempt_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof Email
     */
    last_error_code: string | null;
    /**
     * 
     * @type {any}
     * @memberof Email
     */
    next_attempt_at: any | null;
    /**
     * 
     * @type {EmailObjectEnum}
     * @memberof Email
     */
    object: EmailObjectEnum;
    /**
     * 
     * @type {boolean}
     * @memberof Email
     */
    open_tracking_enabled: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Email
     */
    click_tracking_enabled: boolean;
    /**
     * 
     * @type {any}
     * @memberof Email
     */
    scheduled_at: any | null;
    /**
     * 
     * @type {any}
     * @memberof Email
     */
    cancelled_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof Email
     */
    provider_message_id: string | null;
    /**
     * 
     * @type {MessageOutboundProvider}
     * @memberof Email
     */
    provider: MessageOutboundProvider;
    /**
     * 
     * @type {any}
     * @memberof Email
     */
    sent_at: any | null;
    /**
     * 
     * @type {EmailStatusEnum}
     * @memberof Email
     */
    status: EmailStatusEnum;
    /**
     * 
     * @type {string}
     * @memberof Email
     */
    subject: string;
    /**
     * 
     * @type {Array<EmailTag>}
     * @memberof Email
     */
    tags: Array<EmailTag>;
    /**
     * 
     * @type {string}
     * @memberof Email
     */
    text: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof Email
     */
    to: Array<string>;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Email
     */
    updated_at: string;
}


/**
 * @export
 */
export const EmailDeliveryModeEnum = {
    live: 'live',
    test_sink: 'test-sink'
} as const;
export type EmailDeliveryModeEnum = typeof EmailDeliveryModeEnum[keyof typeof EmailDeliveryModeEnum];

/**
 * @export
 */
export const EmailEnvironmentEnum = {
    live: 'live',
    test: 'test'
} as const;
export type EmailEnvironmentEnum = typeof EmailEnvironmentEnum[keyof typeof EmailEnvironmentEnum];

/**
 * @export
 */
export const EmailObjectEnum = {
    email: 'email'
} as const;
export type EmailObjectEnum = typeof EmailObjectEnum[keyof typeof EmailObjectEnum];

/**
 * @export
 */
export const EmailStatusEnum = {
    queued: 'queued',
    sending: 'sending',
    sent: 'sent',
    failed: 'failed',
    cancelled: 'cancelled'
} as const;
export type EmailStatusEnum = typeof EmailStatusEnum[keyof typeof EmailStatusEnum];

/**
 * 
 * @export
 * @interface EmailAttachment
 */
export interface EmailAttachment {
    /**
     * Canonical Base64 file bytes.
     * @type {string}
     * @memberof EmailAttachment
     */
    content: string;
    /**
     * Optional CID reference for inline images used as cid: URIs in HTML.
     * @type {string}
     * @memberof EmailAttachment
     */
    content_id?: string;
    /**
     * At most 255 UTF-8 bytes; paths and control characters are rejected.
     * @type {string}
     * @memberof EmailAttachment
     */
    filename: string;
    /**
     * 
     * @type {string}
     * @memberof EmailAttachment
     */
    content_type: string;
}
/**
 * 
 * @export
 * @interface EmailBatchEnvelope
 */
export interface EmailBatchEnvelope {
    /**
     * 
     * @type {Array<EmailBatchItem>}
     * @memberof EmailBatchEnvelope
     */
    data: Array<EmailBatchItem>;
}
/**
 * 
 * @export
 * @interface EmailBatchItem
 */
export interface EmailBatchItem {
    /**
     * 
     * @type {string}
     * @memberof EmailBatchItem
     */
    id?: string;
    /**
     * 
     * @type {{ [key: string]: any; }}
     * @memberof EmailBatchItem
     */
    error?: { [key: string]: any; };
}
/**
 * 
 * @export
 * @interface EmailListEnvelope
 */
export interface EmailListEnvelope {
    /**
     * 
     * @type {Array<EmailSummary>}
     * @memberof EmailListEnvelope
     */
    data: Array<EmailSummary>;
    /**
     * 
     * @type {number}
     * @memberof EmailListEnvelope
     */
    limit: number;
    /**
     * 
     * @type {number}
     * @memberof EmailListEnvelope
     */
    page: number;
    /**
     * 
     * @type {number}
     * @memberof EmailListEnvelope
     */
    total: number;
}
/**
 * 
 * @export
 * @interface EmailMetrics
 */
export interface EmailMetrics {
    /**
     * 
     * @type {Array<EmailMetricsDataInner>}
     * @memberof EmailMetrics
     */
    data: Array<EmailMetricsDataInner>;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof EmailMetrics
     */
    end_date: string;
    /**
     * 
     * @type {string}
     * @memberof EmailMetrics
     */
    granularity: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof EmailMetrics
     */
    start_date: string;
    /**
     * 
     * @type {string}
     * @memberof EmailMetrics
     */
    timezone: string;
    /**
     * 
     * @type {{ [key: string]: number; }}
     * @memberof EmailMetrics
     */
    totals: { [key: string]: number; };
}
/**
 * 
 * @export
 * @interface EmailMetricsDataInner
 */
export interface EmailMetricsDataInner {
    /**
     * 
     * @type {Array<EmailMetricsDataInnerDataInner>}
     * @memberof EmailMetricsDataInner
     */
    data: Array<EmailMetricsDataInnerDataInner>;
    /**
     * 
     * @type {{ [key: string]: string | null; }}
     * @memberof EmailMetricsDataInner
     */
    dimensions: { [key: string]: string | null; };
}
/**
 * 
 * @export
 * @interface EmailMetricsDataInnerDataInner
 */
export interface EmailMetricsDataInnerDataInner {
    /**
     * 
     * @type {string}
     * @memberof EmailMetricsDataInnerDataInner
     */
    metric: string;
    /**
     * 
     * @type {number}
     * @memberof EmailMetricsDataInnerDataInner
     */
    value: number;
}
/**
 * 
 * @export
 * @interface EmailSummary
 */
export interface EmailSummary {
    /**
     * 
     * @type {any}
     * @memberof EmailSummary
     */
    cancelled_at: any | null;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof EmailSummary
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof EmailSummary
     */
    domain_id: string | null;
    /**
     * 
     * @type {EmailSummaryEnvironmentEnum}
     * @memberof EmailSummary
     */
    environment: EmailSummaryEnvironmentEnum;
    /**
     * 
     * @type {string}
     * @memberof EmailSummary
     */
    from: string;
    /**
     * 
     * @type {string}
     * @memberof EmailSummary
     */
    id: string;
    /**
     * 
     * @type {EmailSummaryObjectEnum}
     * @memberof EmailSummary
     */
    object: EmailSummaryObjectEnum;
    /**
     * 
     * @type {MessageOutboundProvider}
     * @memberof EmailSummary
     */
    provider: MessageOutboundProvider;
    /**
     * 
     * @type {string}
     * @memberof EmailSummary
     */
    provider_message_id: string | null;
    /**
     * 
     * @type {any}
     * @memberof EmailSummary
     */
    scheduled_at: any | null;
    /**
     * 
     * @type {any}
     * @memberof EmailSummary
     */
    sent_at: any | null;
    /**
     * 
     * @type {EmailSummaryStatusEnum}
     * @memberof EmailSummary
     */
    status: EmailSummaryStatusEnum;
    /**
     * 
     * @type {string}
     * @memberof EmailSummary
     */
    subject: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof EmailSummary
     */
    to: Array<string>;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof EmailSummary
     */
    updated_at: string;
}


/**
 * @export
 */
export const EmailSummaryEnvironmentEnum = {
    live: 'live',
    test: 'test'
} as const;
export type EmailSummaryEnvironmentEnum = typeof EmailSummaryEnvironmentEnum[keyof typeof EmailSummaryEnvironmentEnum];

/**
 * @export
 */
export const EmailSummaryObjectEnum = {
    email: 'email'
} as const;
export type EmailSummaryObjectEnum = typeof EmailSummaryObjectEnum[keyof typeof EmailSummaryObjectEnum];

/**
 * @export
 */
export const EmailSummaryStatusEnum = {
    queued: 'queued',
    sending: 'sending',
    sent: 'sent',
    failed: 'failed',
    cancelled: 'cancelled'
} as const;
export type EmailSummaryStatusEnum = typeof EmailSummaryStatusEnum[keyof typeof EmailSummaryStatusEnum];

/**
 * 
 * @export
 * @interface EmailTag
 */
export interface EmailTag {
    /**
     * 
     * @type {string}
     * @memberof EmailTag
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof EmailTag
     */
    value: string;
}
/**
 * 
 * @export
 * @interface ErrorEnvelope
 */
export interface ErrorEnvelope {
    /**
     * 
     * @type {ErrorEnvelopeError}
     * @memberof ErrorEnvelope
     */
    error: ErrorEnvelopeError;
}
/**
 * 
 * @export
 * @interface ErrorEnvelopeError
 */
export interface ErrorEnvelopeError {
    /**
     * 
     * @type {string}
     * @memberof ErrorEnvelopeError
     */
    code: string;
    /**
     * 
     * @type {string}
     * @memberof ErrorEnvelopeError
     */
    message: string;
    /**
     * 
     * @type {Array<ValidationIssue>}
     * @memberof ErrorEnvelopeError
     */
    fields?: Array<ValidationIssue>;
    /**
     * 
     * @type {ErrorEnvelopeErrorEnvironmentEnum}
     * @memberof ErrorEnvelopeError
     */
    environment?: ErrorEnvelopeErrorEnvironmentEnum;
    /**
     * 
     * @type {number}
     * @memberof ErrorEnvelopeError
     */
    limit?: number;
    /**
     * 
     * @type {number}
     * @memberof ErrorEnvelopeError
     */
    retry_after_seconds?: number;
}


/**
 * @export
 */
export const ErrorEnvelopeErrorEnvironmentEnum = {
    live: 'live',
    test: 'test'
} as const;
export type ErrorEnvelopeErrorEnvironmentEnum = typeof ErrorEnvelopeErrorEnvironmentEnum[keyof typeof ErrorEnvelopeErrorEnvironmentEnum];

/**
 * 
 * @export
 * @interface EventOccurrence
 */
export interface EventOccurrence {
    /**
     * 
     * @type {string}
     * @memberof EventOccurrence
     */
    contact_email: string | null;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof EventOccurrence
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof EventOccurrence
     */
    event_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof EventOccurrence
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof EventOccurrence
     */
    name: string;
    /**
     * 
     * @type {{ [key: string]: any; }}
     * @memberof EventOccurrence
     */
    payload: { [key: string]: any; };
}
/**
 * 
 * @export
 * @interface EventOccurrenceEnvelope
 */
export interface EventOccurrenceEnvelope {
    /**
     * 
     * @type {EventOccurrence}
     * @memberof EventOccurrenceEnvelope
     */
    data: EventOccurrence;
}
/**
 * 
 * @export
 * @interface InlineEmailInput
 */
export interface InlineEmailInput {
    /**
     * Plain address or `Display name <address@example.com>` form.
     * @type {string}
     * @memberof InlineEmailInput
     */
    from: string;
    /**
     * 
     * @type {Recipients}
     * @memberof InlineEmailInput
     */
    to: Recipients;
    /**
     * 
     * @type {string}
     * @memberof InlineEmailInput
     */
    subject: string;
    /**
     * 
     * @type {string}
     * @memberof InlineEmailInput
     */
    html?: string;
    /**
     * API-key-scoped key with a 24-hour lifetime measured using PostgreSQL UTC instants. A replay does not insert or resubmit a provider message.
     * @type {string}
     * @memberof InlineEmailInput
     */
    idempotency_key?: string;
    /**
     * 
     * @type {string}
     * @memberof InlineEmailInput
     */
    text?: string;
    /**
     * 
     * @type {Array<EmailTag>}
     * @memberof InlineEmailInput
     */
    tags?: Array<EmailTag>;
    /**
     * Decoded bytes across all items may total at most 10 MiB.
     * @type {Array<EmailAttachment>}
     * @memberof InlineEmailInput
     */
    attachments?: Array<EmailAttachment>;
    /**
     * 
     * @type {Recipients}
     * @memberof InlineEmailInput
     */
    reply_to?: Recipients;
    /**
     * 
     * @type {Recipients}
     * @memberof InlineEmailInput
     */
    cc?: Recipients;
    /**
     * 
     * @type {Recipients}
     * @memberof InlineEmailInput
     */
    bcc?: Recipients;
    /**
     * Custom MIME headers. Delivery headers such as From, To, Cc, Bcc, Subject, and Date are reserved.
     * @type {{ [key: string]: string; }}
     * @memberof InlineEmailInput
     */
    headers?: { [key: string]: string; };
    /**
     * ISO 8601 instant. Future values queue the message for later delivery; past values send immediately.
     * @type {string}
     * @memberof InlineEmailInput
     */
    scheduled_at?: string;
}
/**
 * 
 * @export
 * @interface InlineEmailInputAnyOf
 */
export interface InlineEmailInputAnyOf {
    /**
     * 
     * @type {string}
     * @memberof InlineEmailInputAnyOf
     */
    html: string;
}
/**
 * 
 * @export
 * @interface InlineEmailInputAnyOf1
 */
export interface InlineEmailInputAnyOf1 {
    /**
     * 
     * @type {string}
     * @memberof InlineEmailInputAnyOf1
     */
    text: string;
}
/**
 * 
 * @export
 * @interface ListEmailEvents200Response
 */
export interface ListEmailEvents200Response {
    /**
     * 
     * @type {Array<MessageEvent>}
     * @memberof ListEmailEvents200Response
     */
    data: Array<MessageEvent>;
}
/**
 * 
 * @export
 * @interface MessageEvent
 */
export interface MessageEvent {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof MessageEvent
     */
    created_at: string;
    /**
     * 
     * @type {{ [key: string]: any; }}
     * @memberof MessageEvent
     */
    data: { [key: string]: any; };
    /**
     * 
     * @type {string}
     * @memberof MessageEvent
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MessageEvent
     */
    message_id: string;
    /**
     * 
     * @type {MessageEventTypeEnum}
     * @memberof MessageEvent
     */
    type: MessageEventTypeEnum;
}


/**
 * @export
 */
export const MessageEventTypeEnum = {
    queued: 'queued',
    delivered: 'delivered',
    deferred: 'deferred',
    bounced: 'bounced',
    complained: 'complained',
    opened: 'opened',
    clicked: 'clicked',
    scheduled: 'scheduled',
    cancelled: 'cancelled'
} as const;
export type MessageEventTypeEnum = typeof MessageEventTypeEnum[keyof typeof MessageEventTypeEnum];


/**
 * 
 * @export
 */
export const MessageOutboundProvider = {
    smtp: 'smtp',
    cloudflare_email: 'cloudflare-email',
    aws_ses: 'aws-ses',
    azure_email: 'azure-email',
    test_sink: 'test-sink'
} as const;
export type MessageOutboundProvider = typeof MessageOutboundProvider[keyof typeof MessageOutboundProvider];

/**
 * 
 * @export
 * @interface OpenTrackingSettings
 */
export interface OpenTrackingSettings {
    /**
     * 
     * @type {boolean}
     * @memberof OpenTrackingSettings
     */
    enabled: boolean;
    /**
     * 
     * @type {OpenTrackingSettingsProtocolTimeZoneEnum}
     * @memberof OpenTrackingSettings
     */
    protocol_time_zone: OpenTrackingSettingsProtocolTimeZoneEnum;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof OpenTrackingSettings
     */
    updated_at: string;
}


/**
 * @export
 */
export const OpenTrackingSettingsProtocolTimeZoneEnum = {
    UTC: 'UTC'
} as const;
export type OpenTrackingSettingsProtocolTimeZoneEnum = typeof OpenTrackingSettingsProtocolTimeZoneEnum[keyof typeof OpenTrackingSettingsProtocolTimeZoneEnum];

/**
 * 
 * @export
 * @interface OpenTrackingUpdateInput
 */
export interface OpenTrackingUpdateInput {
    /**
     * 
     * @type {boolean}
     * @memberof OpenTrackingUpdateInput
     */
    enabled: boolean;
}
/**
 * 
 * @export
 * @interface OrgContact
 */
export interface OrgContact {
    /**
     * 
     * @type {string}
     * @memberof OrgContact
     */
    audience_id: string | null;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof OrgContact
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof OrgContact
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof OrgContact
     */
    first_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrgContact
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof OrgContact
     */
    last_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrgContact
     */
    name: string | null;
    /**
     * 
     * @type {{ [key: string]: any; }}
     * @memberof OrgContact
     */
    properties: { [key: string]: any; };
    /**
     * 
     * @type {Array<ContactSegmentRef>}
     * @memberof OrgContact
     */
    segments: Array<ContactSegmentRef>;
    /**
     * 
     * @type {Array<ContactTopicRef>}
     * @memberof OrgContact
     */
    topics: Array<ContactTopicRef>;
    /**
     * 
     * @type {any}
     * @memberof OrgContact
     */
    unsubscribed_at: any | null;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof OrgContact
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface OrgContactInput
 */
export interface OrgContactInput {
    /**
     * 
     * @type {string}
     * @memberof OrgContactInput
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof OrgContactInput
     */
    first_name?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrgContactInput
     */
    last_name?: string | null;
    /**
     * 
     * @type {{ [key: string]: any; }}
     * @memberof OrgContactInput
     */
    properties?: { [key: string]: any; };
    /**
     * 
     * @type {Array<OrgContactInputSegmentsInner>}
     * @memberof OrgContactInput
     */
    segments?: Array<OrgContactInputSegmentsInner>;
    /**
     * 
     * @type {Array<OrgContactInputTopicsInner>}
     * @memberof OrgContactInput
     */
    topics?: Array<OrgContactInputTopicsInner>;
    /**
     * 
     * @type {boolean}
     * @memberof OrgContactInput
     */
    unsubscribed?: boolean;
}
/**
 * 
 * @export
 * @interface OrgContactInputSegmentsInner
 */
export interface OrgContactInputSegmentsInner {
    /**
     * 
     * @type {string}
     * @memberof OrgContactInputSegmentsInner
     */
    id: string;
}
/**
 * 
 * @export
 * @interface OrgContactInputTopicsInner
 */
export interface OrgContactInputTopicsInner {
    /**
     * 
     * @type {string}
     * @memberof OrgContactInputTopicsInner
     */
    id: string;
    /**
     * 
     * @type {OrgContactInputTopicsInnerSubscriptionEnum}
     * @memberof OrgContactInputTopicsInner
     */
    subscription: OrgContactInputTopicsInnerSubscriptionEnum;
}


/**
 * @export
 */
export const OrgContactInputTopicsInnerSubscriptionEnum = {
    opt_in: 'opt_in',
    opt_out: 'opt_out'
} as const;
export type OrgContactInputTopicsInnerSubscriptionEnum = typeof OrgContactInputTopicsInnerSubscriptionEnum[keyof typeof OrgContactInputTopicsInnerSubscriptionEnum];

/**
 * 
 * @export
 * @interface OrgContactListEnvelope
 */
export interface OrgContactListEnvelope {
    /**
     * 
     * @type {Array<OrgContact>}
     * @memberof OrgContactListEnvelope
     */
    data: Array<OrgContact>;
}
/**
 * 
 * @export
 * @interface OrgContactUpdateInput
 */
export interface OrgContactUpdateInput {
    /**
     * 
     * @type {string}
     * @memberof OrgContactUpdateInput
     */
    email?: string;
    /**
     * 
     * @type {string}
     * @memberof OrgContactUpdateInput
     */
    first_name?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrgContactUpdateInput
     */
    last_name?: string | null;
    /**
     * 
     * @type {{ [key: string]: any; }}
     * @memberof OrgContactUpdateInput
     */
    properties?: { [key: string]: any; };
    /**
     * 
     * @type {boolean}
     * @memberof OrgContactUpdateInput
     */
    unsubscribed?: boolean;
}

/**
 * 
 * @export
 */
export const OutboundProvider = {
    smtp: 'smtp',
    cloudflare_email: 'cloudflare-email',
    aws_ses: 'aws-ses',
    azure_email: 'azure-email'
} as const;
export type OutboundProvider = typeof OutboundProvider[keyof typeof OutboundProvider];

/**
 * 
 * @export
 * @interface OutboundProviderCapabilities
 */
export interface OutboundProviderCapabilities {
    /**
     * 
     * @type {boolean}
     * @memberof OutboundProviderCapabilities
     */
    batch: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof OutboundProviderCapabilities
     */
    events: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof OutboundProviderCapabilities
     */
    scheduling: boolean;
}
/**
 * 
 * @export
 * @interface OutboundProviderConnectionDetails
 */
export interface OutboundProviderConnectionDetails {
    /**
     * 
     * @type {OutboundProviderConnectionDetailsAccountModeEnum}
     * @memberof OutboundProviderConnectionDetails
     */
    account_mode: OutboundProviderConnectionDetailsAccountModeEnum;
    /**
     * 
     * @type {string}
     * @memberof OutboundProviderConnectionDetails
     */
    region: string;
    /**
     * 
     * @type {boolean}
     * @memberof OutboundProviderConnectionDetails
     */
    sending_enabled: boolean;
    /**
     * 
     * @type {Set<string>}
     * @memberof OutboundProviderConnectionDetails
     */
    verified_domains: Set<string>;
}


/**
 * @export
 */
export const OutboundProviderConnectionDetailsAccountModeEnum = {
    sandbox: 'sandbox',
    production: 'production'
} as const;
export type OutboundProviderConnectionDetailsAccountModeEnum = typeof OutboundProviderConnectionDetailsAccountModeEnum[keyof typeof OutboundProviderConnectionDetailsAccountModeEnum];

/**
 * 
 * @export
 * @interface OutboundProviderDomainOverrideInput
 */
export interface OutboundProviderDomainOverrideInput {
    /**
     * 
     * @type {string}
     * @memberof OutboundProviderDomainOverrideInput
     */
    domain_id: string;
    /**
     * 
     * @type {OutboundProvider}
     * @memberof OutboundProviderDomainOverrideInput
     */
    provider: OutboundProvider | null;
}


/**
 * 
 * @export
 * @interface OutboundProviderDomainSetting
 */
export interface OutboundProviderDomainSetting {
    /**
     * 
     * @type {string}
     * @memberof OutboundProviderDomainSetting
     */
    domain_id: string;
    /**
     * 
     * @type {OutboundProvider}
     * @memberof OutboundProviderDomainSetting
     */
    effective_provider: OutboundProvider;
    /**
     * 
     * @type {string}
     * @memberof OutboundProviderDomainSetting
     */
    name: string;
    /**
     * 
     * @type {OutboundProvider}
     * @memberof OutboundProviderDomainSetting
     */
    override_provider: OutboundProvider | null;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof OutboundProviderDomainSetting
     */
    updated_at: string;
}


/**
 * 
 * @export
 * @interface OutboundProviderEventEnvelope
 */
export interface OutboundProviderEventEnvelope {
    /**
     * 
     * @type {Array<OutboundProviderEventResult>}
     * @memberof OutboundProviderEventEnvelope
     */
    data: Array<OutboundProviderEventResult>;
    /**
     * 
     * @type {OutboundProviderEventEnvelopeProtocolTimeZoneEnum}
     * @memberof OutboundProviderEventEnvelope
     */
    protocol_time_zone: OutboundProviderEventEnvelopeProtocolTimeZoneEnum;
}


/**
 * @export
 */
export const OutboundProviderEventEnvelopeProtocolTimeZoneEnum = {
    UTC: 'UTC'
} as const;
export type OutboundProviderEventEnvelopeProtocolTimeZoneEnum = typeof OutboundProviderEventEnvelopeProtocolTimeZoneEnum[keyof typeof OutboundProviderEventEnvelopeProtocolTimeZoneEnum];

/**
 * 
 * @export
 * @interface OutboundProviderEventResult
 */
export interface OutboundProviderEventResult {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof OutboundProviderEventResult
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof OutboundProviderEventResult
     */
    event_id: string;
    /**
     * 
     * @type {string}
     * @memberof OutboundProviderEventResult
     */
    message_id: string;
    /**
     * 
     * @type {OutboundProviderEventResultProviderEnum}
     * @memberof OutboundProviderEventResult
     */
    provider: OutboundProviderEventResultProviderEnum;
    /**
     * 
     * @type {string}
     * @memberof OutboundProviderEventResult
     */
    provider_event_id: string;
    /**
     * 
     * @type {boolean}
     * @memberof OutboundProviderEventResult
     */
    replayed: boolean;
    /**
     * 
     * @type {number}
     * @memberof OutboundProviderEventResult
     */
    suppression_count: number;
    /**
     * 
     * @type {OutboundProviderEventResultTypeEnum}
     * @memberof OutboundProviderEventResult
     */
    type: OutboundProviderEventResultTypeEnum;
}


/**
 * @export
 */
export const OutboundProviderEventResultProviderEnum = {
    aws_ses: 'aws-ses'
} as const;
export type OutboundProviderEventResultProviderEnum = typeof OutboundProviderEventResultProviderEnum[keyof typeof OutboundProviderEventResultProviderEnum];

/**
 * @export
 */
export const OutboundProviderEventResultTypeEnum = {
    delivered: 'delivered',
    deferred: 'deferred',
    bounced: 'bounced',
    complained: 'complained'
} as const;
export type OutboundProviderEventResultTypeEnum = typeof OutboundProviderEventResultTypeEnum[keyof typeof OutboundProviderEventResultTypeEnum];

/**
 * 
 * @export
 * @interface OutboundProviderSettings
 */
export interface OutboundProviderSettings {
    /**
     * 
     * @type {OutboundProvider}
     * @memberof OutboundProviderSettings
     */
    default_provider: OutboundProvider;
    /**
     * 
     * @type {Array<OutboundProviderDomainSetting>}
     * @memberof OutboundProviderSettings
     */
    domains: Array<OutboundProviderDomainSetting>;
    /**
     * 
     * @type {OutboundProviderSettingsProtocolTimeZoneEnum}
     * @memberof OutboundProviderSettings
     */
    protocol_time_zone: OutboundProviderSettingsProtocolTimeZoneEnum;
    /**
     * 
     * @type {Array<OutboundProviderStatus>}
     * @memberof OutboundProviderSettings
     */
    providers: Array<OutboundProviderStatus>;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof OutboundProviderSettings
     */
    updated_at: string;
}


/**
 * @export
 */
export const OutboundProviderSettingsProtocolTimeZoneEnum = {
    UTC: 'UTC'
} as const;
export type OutboundProviderSettingsProtocolTimeZoneEnum = typeof OutboundProviderSettingsProtocolTimeZoneEnum[keyof typeof OutboundProviderSettingsProtocolTimeZoneEnum];

/**
 * 
 * @export
 * @interface OutboundProviderStatus
 */
export interface OutboundProviderStatus {
    /**
     * 
     * @type {OutboundProviderCapabilities}
     * @memberof OutboundProviderStatus
     */
    capabilities: OutboundProviderCapabilities;
    /**
     * 
     * @type {boolean}
     * @memberof OutboundProviderStatus
     */
    configured: boolean;
    /**
     * 
     * @type {OutboundProviderStatusCredentialScopeEnum}
     * @memberof OutboundProviderStatus
     */
    credential_scope: OutboundProviderStatusCredentialScopeEnum | null;
    /**
     * 
     * @type {OutboundProvider}
     * @memberof OutboundProviderStatus
     */
    id: OutboundProvider;
    /**
     * 
     * @type {string}
     * @memberof OutboundProviderStatus
     */
    label: string;
    /**
     * 
     * @type {OutboundProviderStatusStateEnum}
     * @memberof OutboundProviderStatus
     */
    state: OutboundProviderStatusStateEnum;
}


/**
 * @export
 */
export const OutboundProviderStatusCredentialScopeEnum = {
    operator_default: 'operator-default',
    organization: 'organization'
} as const;
export type OutboundProviderStatusCredentialScopeEnum = typeof OutboundProviderStatusCredentialScopeEnum[keyof typeof OutboundProviderStatusCredentialScopeEnum];

/**
 * @export
 */
export const OutboundProviderStatusStateEnum = {
    adapter_unavailable: 'adapter-unavailable',
    configuration_invalid: 'configuration-invalid',
    credentials_missing: 'credentials-missing',
    ready: 'ready'
} as const;
export type OutboundProviderStatusStateEnum = typeof OutboundProviderStatusStateEnum[keyof typeof OutboundProviderStatusStateEnum];

/**
 * 
 * @export
 * @interface OutboundProviderTestInput
 */
export interface OutboundProviderTestInput {
    /**
     * 
     * @type {OutboundProvider}
     * @memberof OutboundProviderTestInput
     */
    provider: OutboundProvider;
}


/**
 * 
 * @export
 * @interface OutboundProviderTestResult
 */
export interface OutboundProviderTestResult {
    /**
     * 
     * @type {OutboundProviderConnectionDetails}
     * @memberof OutboundProviderTestResult
     */
    details: OutboundProviderConnectionDetails | null;
    /**
     * 
     * @type {OutboundProviderTestResultOkEnum}
     * @memberof OutboundProviderTestResult
     */
    ok: OutboundProviderTestResultOkEnum;
    /**
     * 
     * @type {OutboundProviderTestResultProtocolTimeZoneEnum}
     * @memberof OutboundProviderTestResult
     */
    protocol_time_zone: OutboundProviderTestResultProtocolTimeZoneEnum;
    /**
     * 
     * @type {OutboundProvider}
     * @memberof OutboundProviderTestResult
     */
    provider: OutboundProvider;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof OutboundProviderTestResult
     */
    tested_at: string;
}


/**
 * @export
 */
export const OutboundProviderTestResultOkEnum = {
    true: true
} as const;
export type OutboundProviderTestResultOkEnum = typeof OutboundProviderTestResultOkEnum[keyof typeof OutboundProviderTestResultOkEnum];

/**
 * @export
 */
export const OutboundProviderTestResultProtocolTimeZoneEnum = {
    UTC: 'UTC'
} as const;
export type OutboundProviderTestResultProtocolTimeZoneEnum = typeof OutboundProviderTestResultProtocolTimeZoneEnum[keyof typeof OutboundProviderTestResultProtocolTimeZoneEnum];

/**
 * 
 * @export
 * @interface OutboundProviderUpdateInput
 */
export interface OutboundProviderUpdateInput {
    /**
     * 
     * @type {OutboundProvider}
     * @memberof OutboundProviderUpdateInput
     */
    default_provider?: OutboundProvider;
    /**
     * 
     * @type {Array<OutboundProviderDomainOverrideInput>}
     * @memberof OutboundProviderUpdateInput
     */
    domain_overrides?: Array<OutboundProviderDomainOverrideInput>;
}


/**
 * 
 * @export
 * @interface QueuedEmail
 */
export interface QueuedEmail {
    /**
     * 
     * @type {string}
     * @memberof QueuedEmail
     */
    id: string;
}
/**
 * 
 * @export
 * @interface RateLimitErrorEnvelope
 */
export interface RateLimitErrorEnvelope {
    /**
     * 
     * @type {RateLimitErrorEnvelopeError}
     * @memberof RateLimitErrorEnvelope
     */
    error: RateLimitErrorEnvelopeError;
}
/**
 * 
 * @export
 * @interface RateLimitErrorEnvelopeError
 */
export interface RateLimitErrorEnvelopeError {
    /**
     * 
     * @type {RateLimitErrorEnvelopeErrorCodeEnum}
     * @memberof RateLimitErrorEnvelopeError
     */
    code: RateLimitErrorEnvelopeErrorCodeEnum;
    /**
     * 
     * @type {RateLimitErrorEnvelopeErrorEnvironmentEnum}
     * @memberof RateLimitErrorEnvelopeError
     */
    environment: RateLimitErrorEnvelopeErrorEnvironmentEnum;
    /**
     * 
     * @type {number}
     * @memberof RateLimitErrorEnvelopeError
     */
    limit: number;
    /**
     * 
     * @type {string}
     * @memberof RateLimitErrorEnvelopeError
     */
    message: string;
    /**
     * 
     * @type {number}
     * @memberof RateLimitErrorEnvelopeError
     */
    retry_after_seconds: number;
}


/**
 * @export
 */
export const RateLimitErrorEnvelopeErrorCodeEnum = {
    rate_limit_exceeded: 'rate_limit_exceeded'
} as const;
export type RateLimitErrorEnvelopeErrorCodeEnum = typeof RateLimitErrorEnvelopeErrorCodeEnum[keyof typeof RateLimitErrorEnvelopeErrorCodeEnum];

/**
 * @export
 */
export const RateLimitErrorEnvelopeErrorEnvironmentEnum = {
    live: 'live',
    test: 'test'
} as const;
export type RateLimitErrorEnvelopeErrorEnvironmentEnum = typeof RateLimitErrorEnvelopeErrorEnvironmentEnum[keyof typeof RateLimitErrorEnvelopeErrorEnvironmentEnum];

/**
 * 
 * @export
 * @interface RateLimitLane
 */
export interface RateLimitLane {
    /**
     * 
     * @type {number}
     * @memberof RateLimitLane
     */
    default_limit_per_minute: number;
    /**
     * 
     * @type {number}
     * @memberof RateLimitLane
     */
    limit_per_minute: number;
    /**
     * 
     * @type {number}
     * @memberof RateLimitLane
     */
    override_limit_per_minute: number | null;
}
/**
 * 
 * @export
 * @interface RateLimitSettings
 */
export interface RateLimitSettings {
    /**
     * 
     * @type {RateLimitLane}
     * @memberof RateLimitSettings
     */
    live: RateLimitLane;
    /**
     * 
     * @type {RateLimitSettingsProtocolTimeZoneEnum}
     * @memberof RateLimitSettings
     */
    protocol_time_zone: RateLimitSettingsProtocolTimeZoneEnum;
    /**
     * 
     * @type {RateLimitLane}
     * @memberof RateLimitSettings
     */
    test: RateLimitLane;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof RateLimitSettings
     */
    updated_at: string;
}


/**
 * @export
 */
export const RateLimitSettingsProtocolTimeZoneEnum = {
    UTC: 'UTC'
} as const;
export type RateLimitSettingsProtocolTimeZoneEnum = typeof RateLimitSettingsProtocolTimeZoneEnum[keyof typeof RateLimitSettingsProtocolTimeZoneEnum];

/**
 * 
 * @export
 * @interface RateLimitUpdateInput
 */
export interface RateLimitUpdateInput {
    /**
     * 
     * @type {number}
     * @memberof RateLimitUpdateInput
     */
    live_limit_per_minute?: number | null;
    /**
     * 
     * @type {number}
     * @memberof RateLimitUpdateInput
     */
    test_limit_per_minute?: number | null;
}
/**
 * Raw RFC 822 or parsed inbound fields used by support desks.
 * @export
 * @interface ReceiveInboundEmailInput
 */
export interface ReceiveInboundEmailInput {
    /**
     * 
     * @type {string}
     * @memberof ReceiveInboundEmailInput
     */
    email?: string;
    /**
     * Plain address or `Display name <address@example.com>` form.
     * @type {string}
     * @memberof ReceiveInboundEmailInput
     */
    from?: string;
    /**
     * 
     * @type {Recipients}
     * @memberof ReceiveInboundEmailInput
     */
    to?: Recipients;
    /**
     * 
     * @type {Recipients}
     * @memberof ReceiveInboundEmailInput
     */
    cc?: Recipients;
    /**
     * 
     * @type {Recipients}
     * @memberof ReceiveInboundEmailInput
     */
    bcc?: Recipients;
    /**
     * 
     * @type {string}
     * @memberof ReceiveInboundEmailInput
     */
    subject?: string;
    /**
     * 
     * @type {string}
     * @memberof ReceiveInboundEmailInput
     */
    html?: string;
    /**
     * 
     * @type {string}
     * @memberof ReceiveInboundEmailInput
     */
    text?: string;
    /**
     * 
     * @type {string}
     * @memberof ReceiveInboundEmailInput
     */
    message_id?: string;
}
/**
 * 
 * @export
 * @interface ReceivedEmail
 */
export interface ReceivedEmail {
    /**
     * 
     * @type {string}
     * @memberof ReceivedEmail
     */
    id: string;
    /**
     * 
     * @type {ReceivedEmailObjectEnum}
     * @memberof ReceivedEmail
     */
    object: ReceivedEmailObjectEnum;
    /**
     * 
     * @type {string}
     * @memberof ReceivedEmail
     */
    from: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof ReceivedEmail
     */
    to: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof ReceivedEmail
     */
    cc?: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof ReceivedEmail
     */
    bcc?: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof ReceivedEmail
     */
    subject: string;
    /**
     * 
     * @type {string}
     * @memberof ReceivedEmail
     */
    html?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ReceivedEmail
     */
    text?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ReceivedEmail
     */
    message_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ReceivedEmail
     */
    created_at: string;
}


/**
 * @export
 */
export const ReceivedEmailObjectEnum = {
    email: 'email'
} as const;
export type ReceivedEmailObjectEnum = typeof ReceivedEmailObjectEnum[keyof typeof ReceivedEmailObjectEnum];

/**
 * 
 * @export
 * @interface ReceivedEmailAccepted
 */
export interface ReceivedEmailAccepted {
    /**
     * 
     * @type {string}
     * @memberof ReceivedEmailAccepted
     */
    id: string;
    /**
     * 
     * @type {ReceivedEmailAcceptedObjectEnum}
     * @memberof ReceivedEmailAccepted
     */
    object: ReceivedEmailAcceptedObjectEnum;
}


/**
 * @export
 */
export const ReceivedEmailAcceptedObjectEnum = {
    email: 'email'
} as const;
export type ReceivedEmailAcceptedObjectEnum = typeof ReceivedEmailAcceptedObjectEnum[keyof typeof ReceivedEmailAcceptedObjectEnum];

/**
 * 
 * @export
 * @interface ReceivedEmailDiscarded
 */
export interface ReceivedEmailDiscarded {
    /**
     * 
     * @type {ReceivedEmailDiscardedDiscardedEnum}
     * @memberof ReceivedEmailDiscarded
     */
    discarded: ReceivedEmailDiscardedDiscardedEnum;
    /**
     * 
     * @type {ReceivedEmailDiscardedObjectEnum}
     * @memberof ReceivedEmailDiscarded
     */
    object: ReceivedEmailDiscardedObjectEnum;
    /**
     * 
     * @type {ReceivedEmailDiscardedReasonEnum}
     * @memberof ReceivedEmailDiscarded
     */
    reason: ReceivedEmailDiscardedReasonEnum;
}


/**
 * @export
 */
export const ReceivedEmailDiscardedDiscardedEnum = {
    true: true
} as const;
export type ReceivedEmailDiscardedDiscardedEnum = typeof ReceivedEmailDiscardedDiscardedEnum[keyof typeof ReceivedEmailDiscardedDiscardedEnum];

/**
 * @export
 */
export const ReceivedEmailDiscardedObjectEnum = {
    email: 'email'
} as const;
export type ReceivedEmailDiscardedObjectEnum = typeof ReceivedEmailDiscardedObjectEnum[keyof typeof ReceivedEmailDiscardedObjectEnum];

/**
 * @export
 */
export const ReceivedEmailDiscardedReasonEnum = {
    auto_reply: 'auto_reply',
    bounce: 'bounce'
} as const;
export type ReceivedEmailDiscardedReasonEnum = typeof ReceivedEmailDiscardedReasonEnum[keyof typeof ReceivedEmailDiscardedReasonEnum];

/**
 * @type Recipients
 * 
 * @export
 */
export type Recipients = Array<string> | string;
/**
 * 
 * @export
 * @interface RescheduleEmailInput
 */
export interface RescheduleEmailInput {
    /**
     * ISO 8601 instant. Future values queue the message for later delivery; past values send immediately.
     * @type {string}
     * @memberof RescheduleEmailInput
     */
    scheduled_at: string;
}
/**
 * 
 * @export
 * @interface RetrievedEmailAttachment
 */
export interface RetrievedEmailAttachment {
    /**
     * 
     * @type {string}
     * @memberof RetrievedEmailAttachment
     */
    content_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof RetrievedEmailAttachment
     */
    content_type: string;
    /**
     * Signed expiring download URL.
     * @type {string}
     * @memberof RetrievedEmailAttachment
     */
    download_url: string;
    /**
     * 
     * @type {string}
     * @memberof RetrievedEmailAttachment
     */
    filename: string;
    /**
     * 
     * @type {string}
     * @memberof RetrievedEmailAttachment
     */
    id: string;
}
/**
 * 
 * @export
 * @interface RetrievedEmailAttachmentListEnvelope
 */
export interface RetrievedEmailAttachmentListEnvelope {
    /**
     * 
     * @type {Array<RetrievedEmailAttachment>}
     * @memberof RetrievedEmailAttachmentListEnvelope
     */
    data: Array<RetrievedEmailAttachment>;
    /**
     * 
     * @type {RetrievedEmailAttachmentListEnvelopeObjectEnum}
     * @memberof RetrievedEmailAttachmentListEnvelope
     */
    object: RetrievedEmailAttachmentListEnvelopeObjectEnum;
}


/**
 * @export
 */
export const RetrievedEmailAttachmentListEnvelopeObjectEnum = {
    list: 'list'
} as const;
export type RetrievedEmailAttachmentListEnvelopeObjectEnum = typeof RetrievedEmailAttachmentListEnvelopeObjectEnum[keyof typeof RetrievedEmailAttachmentListEnvelopeObjectEnum];

/**
 * 
 * @export
 * @interface Segment
 */
export interface Segment {
    /**
     * 
     * @type {number}
     * @memberof Segment
     */
    contact_count: number;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Segment
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Segment
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Segment
     */
    name: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Segment
     */
    updated_at: string;
}
/**
 * 
 * @export
 * @interface SegmentInput
 */
export interface SegmentInput {
    /**
     * 
     * @type {string}
     * @memberof SegmentInput
     */
    name: string;
}
/**
 * 
 * @export
 * @interface SegmentListEnvelope
 */
export interface SegmentListEnvelope {
    /**
     * 
     * @type {Array<Segment>}
     * @memberof SegmentListEnvelope
     */
    data: Array<Segment>;
}
/**
 * @type SendEmailInput
 * 
 * @export
 */
export type SendEmailInput = InlineEmailInput | TemplateEmailInput;
/**
 * 
 * @export
 * @interface SendEventInput
 */
export interface SendEventInput {
    /**
     * 
     * @type {string}
     * @memberof SendEventInput
     */
    contact_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SendEventInput
     */
    email?: string;
    /**
     * 
     * @type {string}
     * @memberof SendEventInput
     */
    event: string;
    /**
     * 
     * @type {{ [key: string]: any; }}
     * @memberof SendEventInput
     */
    payload?: { [key: string]: any; };
}
/**
 * 
 * @export
 * @interface ShareEmailInput
 */
export interface ShareEmailInput {
    /**
     * Duration like 10m, 2 hours, or 1 day. Defaults to 48h and cannot exceed 48 hours.
     * @type {string}
     * @memberof ShareEmailInput
     */
    expires_in?: string;
}
/**
 * 
 * @export
 * @interface SharedEmail
 */
export interface SharedEmail {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof SharedEmail
     */
    expires_at: string;
    /**
     * 
     * @type {string}
     * @memberof SharedEmail
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SharedEmail
     */
    url: string;
}
/**
 * 
 * @export
 * @interface SharedEmailContent
 */
export interface SharedEmailContent {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof SharedEmailContent
     */
    expires_at: string;
    /**
     * 
     * @type {string}
     * @memberof SharedEmailContent
     */
    from: string;
    /**
     * 
     * @type {string}
     * @memberof SharedEmailContent
     */
    html: string | null;
    /**
     * 
     * @type {string}
     * @memberof SharedEmailContent
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SharedEmailContent
     */
    subject: string;
    /**
     * 
     * @type {string}
     * @memberof SharedEmailContent
     */
    text: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof SharedEmailContent
     */
    to: Array<string>;
}
/**
 * 
 * @export
 * @interface StoredAttachment
 */
export interface StoredAttachment {
    /**
     * CID reference for inline images, or null for regular attachments.
     * @type {string}
     * @memberof StoredAttachment
     */
    content_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof StoredAttachment
     */
    content_type: string;
    /**
     * 
     * @type {string}
     * @memberof StoredAttachment
     */
    filename: string;
    /**
     * 
     * @type {string}
     * @memberof StoredAttachment
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof StoredAttachment
     */
    size: number;
}
/**
 * 
 * @export
 * @interface Suppression
 */
export interface Suppression {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Suppression
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Suppression
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof Suppression
     */
    id: string;
    /**
     * 
     * @type {SuppressionReason}
     * @memberof Suppression
     */
    reason: SuppressionReason;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Suppression
     */
    updated_at: string;
}


/**
 * 
 * @export
 * @interface SuppressionInput
 */
export interface SuppressionInput {
    /**
     * 
     * @type {string}
     * @memberof SuppressionInput
     */
    email: string;
    /**
     * 
     * @type {SuppressionReason}
     * @memberof SuppressionInput
     */
    reason: SuppressionReason;
}


/**
 * 
 * @export
 * @interface SuppressionListEnvelope
 */
export interface SuppressionListEnvelope {
    /**
     * 
     * @type {Array<Suppression>}
     * @memberof SuppressionListEnvelope
     */
    data: Array<Suppression>;
    /**
     * 
     * @type {SuppressionListEnvelopeProtocolTimeZoneEnum}
     * @memberof SuppressionListEnvelope
     */
    protocol_time_zone: SuppressionListEnvelopeProtocolTimeZoneEnum;
}


/**
 * @export
 */
export const SuppressionListEnvelopeProtocolTimeZoneEnum = {
    UTC: 'UTC'
} as const;
export type SuppressionListEnvelopeProtocolTimeZoneEnum = typeof SuppressionListEnvelopeProtocolTimeZoneEnum[keyof typeof SuppressionListEnvelopeProtocolTimeZoneEnum];


/**
 * 
 * @export
 */
export const SuppressionReason = {
    manual: 'manual',
    unsubscribed: 'unsubscribed',
    bounced: 'bounced',
    complained: 'complained'
} as const;
export type SuppressionReason = typeof SuppressionReason[keyof typeof SuppressionReason];

/**
 * 
 * @export
 * @interface SuppressionUpdateInput
 */
export interface SuppressionUpdateInput {
    /**
     * 
     * @type {string}
     * @memberof SuppressionUpdateInput
     */
    email?: string;
    /**
     * 
     * @type {SuppressionReason}
     * @memberof SuppressionUpdateInput
     */
    reason?: SuppressionReason;
}


/**
 * 
 * @export
 * @interface Template
 */
export interface Template {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Template
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Template
     */
    html: string | null;
    /**
     * 
     * @type {string}
     * @memberof Template
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Template
     */
    name: string;
    /**
     * 
     * @type {any}
     * @memberof Template
     */
    published_at: any | null;
    /**
     * 
     * @type {number}
     * @memberof Template
     */
    published_version: number | null;
    /**
     * 
     * @type {string}
     * @memberof Template
     */
    react: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof Template
     */
    required_variables: Array<string>;
    /**
     * 
     * @type {TemplateStatusEnum}
     * @memberof Template
     */
    status: TemplateStatusEnum;
    /**
     * 
     * @type {string}
     * @memberof Template
     */
    subject: string;
    /**
     * 
     * @type {string}
     * @memberof Template
     */
    text: string | null;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Template
     */
    updated_at: string;
    /**
     * 
     * @type {number}
     * @memberof Template
     */
    version: number;
}


/**
 * @export
 */
export const TemplateStatusEnum = {
    draft: 'draft',
    published: 'published'
} as const;
export type TemplateStatusEnum = typeof TemplateStatusEnum[keyof typeof TemplateStatusEnum];

/**
 * 
 * @export
 * @interface TemplateEmailInput
 */
export interface TemplateEmailInput {
    /**
     * Plain address or `Display name <address@example.com>` form.
     * @type {string}
     * @memberof TemplateEmailInput
     */
    from: string;
    /**
     * 
     * @type {Recipients}
     * @memberof TemplateEmailInput
     */
    to: Recipients;
    /**
     * 
     * @type {string}
     * @memberof TemplateEmailInput
     */
    template_id: string;
    /**
     * 
     * @type {{ [key: string]: any; }}
     * @memberof TemplateEmailInput
     */
    data?: { [key: string]: any; };
    /**
     * API-key-scoped key with a 24-hour lifetime measured using PostgreSQL UTC instants. A replay does not insert or resubmit a provider message.
     * @type {string}
     * @memberof TemplateEmailInput
     */
    idempotency_key?: string;
    /**
     * 
     * @type {Array<EmailTag>}
     * @memberof TemplateEmailInput
     */
    tags?: Array<EmailTag>;
    /**
     * Decoded bytes across all items may total at most 10 MiB.
     * @type {Array<EmailAttachment>}
     * @memberof TemplateEmailInput
     */
    attachments?: Array<EmailAttachment>;
    /**
     * 
     * @type {Recipients}
     * @memberof TemplateEmailInput
     */
    reply_to?: Recipients;
    /**
     * 
     * @type {Recipients}
     * @memberof TemplateEmailInput
     */
    cc?: Recipients;
    /**
     * 
     * @type {Recipients}
     * @memberof TemplateEmailInput
     */
    bcc?: Recipients;
    /**
     * Custom MIME headers. Delivery headers such as From, To, Cc, Bcc, Subject, and Date are reserved.
     * @type {{ [key: string]: string; }}
     * @memberof TemplateEmailInput
     */
    headers?: { [key: string]: string; };
    /**
     * ISO 8601 instant. Future values queue the message for later delivery; past values send immediately.
     * @type {string}
     * @memberof TemplateEmailInput
     */
    scheduled_at?: string;
}
/**
 * 
 * @export
 * @interface TemplateInput
 */
export interface TemplateInput {
    /**
     * 
     * @type {string}
     * @memberof TemplateInput
     */
    html?: string | null;
    /**
     * 
     * @type {string}
     * @memberof TemplateInput
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof TemplateInput
     */
    react?: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof TemplateInput
     */
    required_variables?: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof TemplateInput
     */
    subject: string;
    /**
     * 
     * @type {string}
     * @memberof TemplateInput
     */
    text?: string | null;
}
/**
 * 
 * @export
 * @interface TemplateListEnvelope
 */
export interface TemplateListEnvelope {
    /**
     * 
     * @type {Array<Template>}
     * @memberof TemplateListEnvelope
     */
    data: Array<Template>;
}
/**
 * 
 * @export
 * @interface TemplatePreview
 */
export interface TemplatePreview {
    /**
     * 
     * @type {string}
     * @memberof TemplatePreview
     */
    html: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof TemplatePreview
     */
    missing_variables: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof TemplatePreview
     */
    subject: string;
    /**
     * 
     * @type {string}
     * @memberof TemplatePreview
     */
    template_id: string;
    /**
     * 
     * @type {string}
     * @memberof TemplatePreview
     */
    text: string | null;
}
/**
 * 
 * @export
 * @interface TemplatePreviewInput
 */
export interface TemplatePreviewInput {
    /**
     * 
     * @type {{ [key: string]: any; }}
     * @memberof TemplatePreviewInput
     */
    data?: { [key: string]: any; };
}
/**
 * 
 * @export
 * @interface Topic
 */
export interface Topic {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Topic
     */
    created_at: string;
    /**
     * 
     * @type {TopicDefaultSubscriptionEnum}
     * @memberof Topic
     */
    default_subscription: TopicDefaultSubscriptionEnum;
    /**
     * 
     * @type {string}
     * @memberof Topic
     */
    description: string | null;
    /**
     * 
     * @type {string}
     * @memberof Topic
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Topic
     */
    name: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Topic
     */
    updated_at: string;
    /**
     * 
     * @type {TopicVisibilityEnum}
     * @memberof Topic
     */
    visibility: TopicVisibilityEnum;
}


/**
 * @export
 */
export const TopicDefaultSubscriptionEnum = {
    opt_in: 'opt_in',
    opt_out: 'opt_out'
} as const;
export type TopicDefaultSubscriptionEnum = typeof TopicDefaultSubscriptionEnum[keyof typeof TopicDefaultSubscriptionEnum];

/**
 * @export
 */
export const TopicVisibilityEnum = {
    public: 'public',
    private: 'private'
} as const;
export type TopicVisibilityEnum = typeof TopicVisibilityEnum[keyof typeof TopicVisibilityEnum];

/**
 * 
 * @export
 * @interface TopicInput
 */
export interface TopicInput {
    /**
     * 
     * @type {TopicInputDefaultSubscriptionEnum}
     * @memberof TopicInput
     */
    default_subscription: TopicInputDefaultSubscriptionEnum;
    /**
     * 
     * @type {string}
     * @memberof TopicInput
     */
    description?: string | null;
    /**
     * 
     * @type {string}
     * @memberof TopicInput
     */
    name: string;
    /**
     * 
     * @type {TopicInputVisibilityEnum}
     * @memberof TopicInput
     */
    visibility?: TopicInputVisibilityEnum;
}


/**
 * @export
 */
export const TopicInputDefaultSubscriptionEnum = {
    opt_in: 'opt_in',
    opt_out: 'opt_out'
} as const;
export type TopicInputDefaultSubscriptionEnum = typeof TopicInputDefaultSubscriptionEnum[keyof typeof TopicInputDefaultSubscriptionEnum];

/**
 * @export
 */
export const TopicInputVisibilityEnum = {
    public: 'public',
    private: 'private'
} as const;
export type TopicInputVisibilityEnum = typeof TopicInputVisibilityEnum[keyof typeof TopicInputVisibilityEnum];

/**
 * 
 * @export
 * @interface TopicListEnvelope
 */
export interface TopicListEnvelope {
    /**
     * 
     * @type {Array<Topic>}
     * @memberof TopicListEnvelope
     */
    data: Array<Topic>;
}
/**
 * 
 * @export
 * @interface TopicUpdateInput
 */
export interface TopicUpdateInput {
    /**
     * 
     * @type {string}
     * @memberof TopicUpdateInput
     */
    description?: string | null;
    /**
     * 
     * @type {string}
     * @memberof TopicUpdateInput
     */
    name?: string;
    /**
     * 
     * @type {TopicUpdateInputVisibilityEnum}
     * @memberof TopicUpdateInput
     */
    visibility?: TopicUpdateInputVisibilityEnum;
}


/**
 * @export
 */
export const TopicUpdateInputVisibilityEnum = {
    public: 'public',
    private: 'private'
} as const;
export type TopicUpdateInputVisibilityEnum = typeof TopicUpdateInputVisibilityEnum[keyof typeof TopicUpdateInputVisibilityEnum];

/**
 * 
 * @export
 * @interface ValidationIssue
 */
export interface ValidationIssue {
    /**
     * 
     * @type {string}
     * @memberof ValidationIssue
     */
    field: string;
    /**
     * 
     * @type {string}
     * @memberof ValidationIssue
     */
    message: string;
}
/**
 * 
 * @export
 * @interface Webhook
 */
export interface Webhook {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Webhook
     */
    created_at: string;
    /**
     * 
     * @type {boolean}
     * @memberof Webhook
     */
    enabled: boolean;
    /**
     * 
     * @type {string}
     * @memberof Webhook
     */
    id: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof Webhook
     */
    updated_at: string;
    /**
     * 
     * @type {string}
     * @memberof Webhook
     */
    url: string;
}
/**
 * 
 * @export
 * @interface WebhookConfigurationEnvelope
 */
export interface WebhookConfigurationEnvelope {
    /**
     * 
     * @type {WebhookConfiguredEndpoint}
     * @memberof WebhookConfigurationEnvelope
     */
    data: WebhookConfiguredEndpoint;
}
/**
 * 
 * @export
 * @interface WebhookConfigurationInput
 */
export interface WebhookConfigurationInput {
    /**
     * Public HTTPS URL without embedded credentials or a fragment. Loopback, private, link-local, CGNAT, and reserved addresses are rejected unless the operator sets PAPERBOY_WEBHOOK_ALLOW_PRIVATE_NETWORKS.
     * @type {string}
     * @memberof WebhookConfigurationInput
     */
    url: string;
}
/**
 * 
 * @export
 * @interface WebhookConfiguredEndpoint
 */
export interface WebhookConfiguredEndpoint {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof WebhookConfiguredEndpoint
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookConfiguredEndpoint
     */
    id: string;
    /**
     * Returned only on first creation and never by GET.
     * @type {string}
     * @memberof WebhookConfiguredEndpoint
     */
    signing_secret: string | null;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof WebhookConfiguredEndpoint
     */
    updated_at: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookConfiguredEndpoint
     */
    url: string;
}
/**
 * 
 * @export
 * @interface WebhookCreateEnvelope
 */
export interface WebhookCreateEnvelope {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof WebhookCreateEnvelope
     */
    created_at: string;
    /**
     * 
     * @type {boolean}
     * @memberof WebhookCreateEnvelope
     */
    enabled: boolean;
    /**
     * 
     * @type {string}
     * @memberof WebhookCreateEnvelope
     */
    id: string;
    /**
     * Returned only on creation and never by GET.
     * @type {string}
     * @memberof WebhookCreateEnvelope
     */
    signing_secret: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof WebhookCreateEnvelope
     */
    updated_at: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookCreateEnvelope
     */
    url: string;
}
/**
 * 
 * @export
 * @interface WebhookCreateInput
 */
export interface WebhookCreateInput {
    /**
     * 
     * @type {boolean}
     * @memberof WebhookCreateInput
     */
    enabled?: boolean;
    /**
     * 
     * @type {string}
     * @memberof WebhookCreateInput
     */
    url: string;
}
/**
 * 
 * @export
 * @interface WebhookDelivery
 */
export interface WebhookDelivery {
    /**
     * 
     * @type {number}
     * @memberof WebhookDelivery
     */
    attempt_count: number;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof WebhookDelivery
     */
    created_at: string;
    /**
     * 
     * @type {any}
     * @memberof WebhookDelivery
     */
    delivered_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof WebhookDelivery
     */
    endpoint_id: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookDelivery
     */
    event_type: string | null;
    /**
     * 
     * @type {any}
     * @memberof WebhookDelivery
     */
    failed_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof WebhookDelivery
     */
    failure_reason: string | null;
    /**
     * 
     * @type {string}
     * @memberof WebhookDelivery
     */
    id: string;
    /**
     * 
     * @type {any}
     * @memberof WebhookDelivery
     */
    last_attempt_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof WebhookDelivery
     */
    last_error_code: string | null;
    /**
     * 
     * @type {number}
     * @memberof WebhookDelivery
     */
    response_status: number | null;
    /**
     * 
     * @type {string}
     * @memberof WebhookDelivery
     */
    status: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof WebhookDelivery
     */
    updated_at: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookDelivery
     */
    url: string;
}
/**
 * 
 * @export
 * @interface WebhookDeliveryAttempt
 */
export interface WebhookDeliveryAttempt {
    /**
     * 
     * @type {number}
     * @memberof WebhookDeliveryAttempt
     */
    attempt_count: number;
    /**
     * 
     * @type {any}
     * @memberof WebhookDeliveryAttempt
     */
    attempted_at: any | null;
    /**
     * 
     * @type {string}
     * @memberof WebhookDeliveryAttempt
     */
    failure_reason: string | null;
    /**
     * 
     * @type {string}
     * @memberof WebhookDeliveryAttempt
     */
    last_error_code: string | null;
    /**
     * 
     * @type {number}
     * @memberof WebhookDeliveryAttempt
     */
    response_status: number | null;
    /**
     * 
     * @type {string}
     * @memberof WebhookDeliveryAttempt
     */
    status: string;
}
/**
 * 
 * @export
 * @interface WebhookDeliveryAttemptListEnvelope
 */
export interface WebhookDeliveryAttemptListEnvelope {
    /**
     * 
     * @type {Array<WebhookDeliveryAttempt>}
     * @memberof WebhookDeliveryAttemptListEnvelope
     */
    data: Array<WebhookDeliveryAttempt>;
}
/**
 * 
 * @export
 * @interface WebhookDeliveryListEnvelope
 */
export interface WebhookDeliveryListEnvelope {
    /**
     * 
     * @type {Array<WebhookDelivery>}
     * @memberof WebhookDeliveryListEnvelope
     */
    data: Array<WebhookDelivery>;
}
/**
 * 
 * @export
 * @interface WebhookEndpoint
 */
export interface WebhookEndpoint {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof WebhookEndpoint
     */
    created_at: string;
    /**
     * 
     * @type {boolean}
     * @memberof WebhookEndpoint
     */
    enabled: boolean;
    /**
     * 
     * @type {string}
     * @memberof WebhookEndpoint
     */
    id: string;
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof WebhookEndpoint
     */
    updated_at: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookEndpoint
     */
    url: string;
}
/**
 * 
 * @export
 * @interface WebhookEvent
 */
export interface WebhookEvent {
    /**
     * RFC 3339 UTC instant. PaperBoy serializes this with a trailing `Z`.
     * @type {string}
     * @memberof WebhookEvent
     */
    created_at: string;
    /**
     * 
     * @type {WebhookEventData}
     * @memberof WebhookEvent
     */
    data: WebhookEventData;
    /**
     * 
     * @type {WebhookEventTypeEnum}
     * @memberof WebhookEvent
     */
    type: WebhookEventTypeEnum;
}


/**
 * @export
 */
export const WebhookEventTypeEnum = {
    email_queued: 'email.queued',
    email_delivered: 'email.delivered',
    email_deferred: 'email.deferred',
    email_bounced: 'email.bounced',
    email_complained: 'email.complained',
    email_opened: 'email.opened',
    email_clicked: 'email.clicked',
    email_scheduled: 'email.scheduled',
    email_cancelled: 'email.cancelled'
} as const;
export type WebhookEventTypeEnum = typeof WebhookEventTypeEnum[keyof typeof WebhookEventTypeEnum];

/**
 * 
 * @export
 * @interface WebhookEventData
 */
export interface WebhookEventData {
    /**
     * 
     * @type {string}
     * @memberof WebhookEventData
     */
    email_id: string;
    /**
     * 
     * @type {WebhookEventDataEnvironmentEnum}
     * @memberof WebhookEventData
     */
    environment: WebhookEventDataEnvironmentEnum;
}


/**
 * @export
 */
export const WebhookEventDataEnvironmentEnum = {
    live: 'live',
    test: 'test'
} as const;
export type WebhookEventDataEnvironmentEnum = typeof WebhookEventDataEnvironmentEnum[keyof typeof WebhookEventDataEnvironmentEnum];

/**
 * 
 * @export
 * @interface WebhookListEnvelope
 */
export interface WebhookListEnvelope {
    /**
     * 
     * @type {Array<Webhook>}
     * @memberof WebhookListEnvelope
     */
    data: Array<Webhook>;
}
/**
 * 
 * @export
 * @interface WebhookReadEnvelope
 */
export interface WebhookReadEnvelope {
    /**
     * 
     * @type {WebhookEndpoint}
     * @memberof WebhookReadEnvelope
     */
    data: WebhookEndpoint | null;
}
/**
 * 
 * @export
 * @interface WebhookUpdateInput
 */
export interface WebhookUpdateInput {
    /**
     * 
     * @type {boolean}
     * @memberof WebhookUpdateInput
     */
    enabled?: boolean;
    /**
     * 
     * @type {string}
     * @memberof WebhookUpdateInput
     */
    url?: string;
}
