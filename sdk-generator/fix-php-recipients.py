"""Install the value-union model unsupported by the pinned PHP generator."""

import re
import sys
from pathlib import Path

sdk = Path(sys.argv[1])
path = sdk / "src" / "ObjectSerializer.php"
source = path.read_text()
serialization = """        if (is_object($data)) {"""
serialization_fix = """        // Value-union wrappers expose their JSON value without object properties.
        if ($data instanceof \\PaperBoy\\OpenApi\\Model\\Recipients) {
            return self::sanitizeForSerialization($data->jsonSerialize());
        }

""" + serialization
deserialization = """        if (strcasecmp(substr($class, -2), '[]') === 0) {"""
deserialization_fix = r"""        if (ltrim($class, '\\') === \PaperBoy\OpenApi\Model\Recipients::class) {
            if (is_string($data)) {
                $decoded = json_decode($data, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $data = $decoded;
                }
            }
            return new \PaperBoy\OpenApi\Model\Recipients($data);
        }

""" + deserialization
for original, replacement in [(serialization, serialization_fix), (deserialization, deserialization_fix)]:
    if source.count(original) != 1:
        raise RuntimeError("Expected the pinned PHP serializer branch exactly once")
    source = source.replace(original, replacement)
path.write_text(source)

# Keep the generated ModelInterface and ArrayAccess API, but store the union's
# actual value instead of treating its addresses as absent object properties.
model = sdk / "src" / "Model" / "Recipients.php"
source = model.read_text()
repairs = [
    (r"protected \$container = \[\];", "protected $container = [];\n\n    private ?string $singleRecipient = null;"),
    (r"public function __construct\(\?array \$data = null\)\s*\{\s*\}", """public function __construct(string|array|null $data = null)
    {
        $this->singleRecipient = is_string($data) ? $data : null;
        $this->container = is_string($data) ? [$data] : ($data ?? []);
    }"""),
    (r"(public function jsonSerialize\(\)\s*\{)\s*return ObjectSerializer::sanitizeForSerialization\(\$this\);", r"\1\n        return $this->singleRecipient ?? array_values($this->container);"),
    (r"(public function offset(?:Set|Unset)\([^)]*\): void\s*\{)", r"\1\n        $this->singleRecipient = null;"),
    (r"@param mixed\[\]\|null \$data Associated array of property values\n\s+\* +initializing the model", "@param string|string[]|null $data One address or a list of addresses"),
]
for index, (pattern, replacement) in enumerate(repairs):
    source, count = re.subn(pattern, replacement, source)
    if count != (2 if index == 3 else 1):
        raise RuntimeError("Expected the pinned Recipients model branch exactly once (twice for mutations)")
model.write_text(source)
