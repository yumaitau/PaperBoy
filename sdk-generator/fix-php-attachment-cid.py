"""Match the OpenAPI/JavaScript CID whitespace contract in the pinned PHP model."""

import sys
from pathlib import Path

path = Path(sys.argv[1]) / "src" / "Model" / "EmailAttachment.php"
source = path.read_text()

# PCRE's $ permits a terminal LF. Its default \s is ASCII-only, while UCP
# includes U+0085 and excludes U+FEFF, unlike ECMAScript. Spell out ECMAScript's
# WhiteSpace + LineTerminator set, plus forbidden C0/DEL, and use absolute anchors. UTF mode makes
# these code points meaningful and makes preg_match fail closed on invalid UTF-8.
# These are PHP double-quoted string contents, so regex backslashes are doubled.
# PHP holds UTF-8 bytes rather than UTF-16 code units. PCRE /u already rejects
# encoded surrogates (and other malformed UTF-8); a surrogate range in a /u
# PCRE pattern would fail to compile. Keep the equivalent scalar-value domain.
original = r"/^(?:[^\\s<>,;\\x00-\\x1f\\x7f\\uD800-\\uDFFF]|[\\uD800-\\uDBFF][\\uDC00-\\uDFFF])+$/"
replacement = (
    r"/\\A[^\\x{0000}-\\x{001F}\\x{007F}\\x{0020}\\x{00A0}\\x{1680}"
    r"\\x{2000}-\\x{200A}\\x{2028}\\x{2029}\\x{202F}\\x{205F}"
    r"\\x{3000}\\x{FEFF}<>,;]+\\z/u"
)

# Repair valid()/listInvalidProperties() and setContentId(), including both
# diagnostics. Stop if the pinned generator or source schema changes shape.
if source.count(original) != 4:
    raise RuntimeError("Expected the pinned PHP CID pattern exactly four times")
path.write_text(source.replace(original, replacement))
