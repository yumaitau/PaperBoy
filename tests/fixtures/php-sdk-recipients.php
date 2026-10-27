<?php
spl_autoload_register(function ($class) {
    $prefix = 'PaperBoy\\OpenApi\\';
    if (str_starts_with($class, $prefix)) {
        require __DIR__ . '/../../sdks/php/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    }
});

use PaperBoy\OpenApi\Model\Recipients;
use PaperBoy\OpenApi\Model\SendEmailInput;
use PaperBoy\OpenApi\ObjectSerializer;

$mode = $argv[1];
$value = str_starts_with($mode, 'single') ? 'Reader <reader@example.net>' : ['first@example.net', 'second@example.net'];
$recipients = new Recipients($value);
if ($mode === 'array-access') {
    $unsetOnly = new Recipients('remove@example.net');
    unset($unsetOnly[0]);
    if (json_encode($unsetOnly, JSON_THROW_ON_ERROR) !== '[]') {
        throw new RuntimeException('ArrayAccess unset retained a single recipient');
    }
    $recipients = new Recipients('replace@example.net');
    $recipients[0] = 'first@example.net';
    $recipients[] = 'second@example.net';
    $recipients[] = 'remove@example.net';
    unset($recipients[2]);
}
if (json_encode($recipients, JSON_THROW_ON_ERROR) !== json_encode($value, JSON_THROW_ON_ERROR)) {
    throw new RuntimeException('Native JSON serialization lost recipient values');
}
$input = new SendEmailInput([
    'from' => 'Sender <sender@example.net>',
    'to' => $recipients,
    'cc' => new Recipients(['copy@example.net']),
    'bcc' => new Recipients(['hidden@example.net']),
    'reply_to' => new Recipients(['reply@example.net']),
    'subject' => 'SDK recipients',
    'text' => 'Hello',
]);
$wire = ObjectSerializer::sanitizeForSerialization($input);
if (str_ends_with($mode, 'roundtrip')) {
    $wire = ObjectSerializer::sanitizeForSerialization(ObjectSerializer::deserialize(json_encode($wire, JSON_THROW_ON_ERROR), SendEmailInput::class));
}
echo json_encode($wire, JSON_THROW_ON_ERROR);
