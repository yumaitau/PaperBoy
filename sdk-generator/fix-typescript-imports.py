"""Repair two import bugs in the pinned 7.24.0 typescript-fetch generator.

Webhook request models lose their import name, and alternate multipart request
schemas leave a stale import when the operation uses its JSON request model.
Keep these repairs in generation so checked-in clients remain reproducible.
Fail on unexpected output so generator upgrades require reviewing the workaround.
"""

import re
import sys
from pathlib import Path


def replace_once(path, pattern, replacement):
    source = path.read_text()
    result, count = re.subn(pattern, replacement, source, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError(f"Expected one pinned-generator import defect in {path}, found {count}")
    path.write_text(result)


apis = Path(sys.argv[1]) / "src" / "apis"
replace_once(
    apis / "WebhookDeliveryApi.ts",
    r"import type \{\s*,\s*\} from '../models/index';",
    "import type { WebhookEvent } from '../models/index';",
)
replace_once(
    apis / "ContactsApi.ts",
    r"^[ \t]+CreateContactImportRequest,\n",
    "",
)
