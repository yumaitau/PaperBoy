"""Preserve JSON object/list distinctions in the pinned PHP serializer."""

import sys
from pathlib import Path

path = Path(sys.argv[1]) / "src" / "ObjectSerializer.php"
source = path.read_text()
original = """        if (is_array($data)) {
            foreach ($data as $property => $value) {
                $data[$property] = self::sanitizeForSerialization($value);
            }
            return $data;
        }"""
replacement = """        if (is_array($data)) {
            $isList = is_string($type) && str_ends_with($type, '[]');
            $isMap = !$isList && is_string($type) && preg_match('/^(?:array<|map\\[)[^,]+,(.+)[>\\]]$/', $type, $mapType);
            $itemType = $isList ? substr($type, 0, -2) : ($isMap ? $mapType[1] : null);
            foreach ($data as $property => $value) {
                $data[$property] = self::sanitizeForSerialization($value, $itemType);
            }
            return $isMap ? (object) $data : $data;
        }"""
if source.count(original) != 1:
    raise RuntimeError("Expected the pinned PHP serializer array branch exactly once")
path.write_text(source.replace(original, replacement))
