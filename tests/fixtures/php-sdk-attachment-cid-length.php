<?php
spl_autoload_register(function ($class) {
    $prefix = 'PaperBoy\\OpenApi\\';
    if (str_starts_with($class, $prefix)) {
        require __DIR__ . '/../../sdks/php/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    }
});

use PaperBoy\OpenApi\Model\EmailAttachment;

$results = [];
foreach (json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR) as $cid) {
    $base = ['content' => 'YQ==', 'content_type' => 'image/png', 'filename' => 'a.png'];
    $model = new EmailAttachment($base + ['content_id' => $cid]);
    $setter = new EmailAttachment($base);
    try {
        $setter->setContentId($cid);
        $setterAccepted = $setter->getContentId() === $cid;
    } catch (InvalidArgumentException $error) {
        $setterAccepted = false;
    }
    $results[] = ['valid' => $model->valid(), 'setter' => $setterAccepted];
}
echo json_encode($results, JSON_THROW_ON_ERROR);
