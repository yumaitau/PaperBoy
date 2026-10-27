<?php
spl_autoload_register(function ($class) {
    $prefix = 'PaperBoy\\OpenApi\\';
    if (str_starts_with($class, $prefix)) {
        require __DIR__ . '/../../sdks/php/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    }
});

use PaperBoy\OpenApi\Model\EmailAttachment;

$results = [];
$base64 = ($argv[1] ?? null) === '--base64';
foreach (json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR) as $value) {
    $value = $base64 ? base64_decode($value, true) : $value;
    if ($value === false) {
        throw new InvalidArgumentException('Invalid Base64 test input');
    }
    $data = ['content' => 'aW1hZ2U=', 'content_type' => 'image/png', 'filename' => 'logo.png'];
    $attachment = new EmailAttachment($data + ['content_id' => $value]);
    $constructorValid = $attachment->valid();

    try {
        $attachment = new EmailAttachment($data);
        $attachment->setContentId($value);
        $setterValid = $attachment->getContentId() === $value && $attachment->valid();
    } catch (InvalidArgumentException $error) {
        $setterValid = false;
    }

    $value = $base64 ? base64_encode($value) : $value;
    $results[] = compact('value', 'constructorValid', 'setterValid');
}
echo json_encode($results, JSON_THROW_ON_ERROR);
