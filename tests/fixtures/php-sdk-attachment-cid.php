<?php
spl_autoload_register(function ($class) {
    $prefix = 'PaperBoy\\OpenApi\\';
    if (str_starts_with($class, $prefix)) {
        require __DIR__ . '/../../sdks/php/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    }
});

use PaperBoy\OpenApi\Model\EmailAttachment;

$results = [];
foreach (json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR) as $value) {
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

    $results[] = compact('value', 'constructorValid', 'setterValid');
}
echo json_encode($results, JSON_THROW_ON_ERROR);
