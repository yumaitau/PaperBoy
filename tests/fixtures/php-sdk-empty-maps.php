<?php
spl_autoload_register(function ($class) {
    $prefix = 'PaperBoy\\OpenApi\\';
    if (str_starts_with($class, $prefix)) {
        require __DIR__ . '/../../sdks/php/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    }
});

use PaperBoy\OpenApi\Model\OrgContactUpdateInput;
use PaperBoy\OpenApi\ObjectSerializer;

echo json_encode([
    'update' => ObjectSerializer::sanitizeForSerialization(new OrgContactUpdateInput(['properties' => []])),
    'populated' => ObjectSerializer::sanitizeForSerialization(new OrgContactUpdateInput(['properties' => ['age' => 42, 'active' => false]])),
    'list' => ObjectSerializer::sanitizeForSerialization([], 'string[]'),
    'list_of_maps' => ObjectSerializer::sanitizeForSerialization([[]], 'array<string,mixed>[]'),
    'map_of_maps' => ObjectSerializer::sanitizeForSerialization(['child' => []], 'array<string,array<string,mixed>>'),
    'numeric_keys' => ObjectSerializer::sanitizeForSerialization(['0' => 'zero'], 'array<string,string>'),
], JSON_THROW_ON_ERROR);
