"""Build the upload zip for Partner Center.

    python tools/package.py

Produces dist/site-label-<version>.zip containing only the files the browser
needs - no tools, no docs, no store assets. The version is read from
manifest.json so the two can never drift.
"""

import json
import os
import zipfile

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir))

# Everything the extension actually loads at runtime.
INCLUDE = [
    "manifest.json",
    "icons/icon-16.png",
    "icons/icon-32.png",
    "icons/icon-48.png",
    "icons/icon-128.png",
    "src/background/service-worker.js",
    "src/common/buddies.js",
    "src/common/schema.js",
    "src/common/matcher.js",
    "src/common/storage.js",
    "src/common/preview.js",
    "src/common/consent.js",
    "src/content/label.js",
    "src/popup/popup.html",
    "src/popup/popup.css",
    "src/popup/popup.js",
    "src/options/options.html",
    "src/options/options.css",
    "src/options/options.js",
]


def main():
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as handle:
        manifest = json.load(handle)
    version = manifest["version"]

    missing = [rel for rel in INCLUDE if not os.path.isfile(os.path.join(ROOT, rel))]
    if missing:
        raise SystemExit("Missing files:\n  " + "\n  ".join(missing))

    dist = os.path.join(ROOT, "dist")
    os.makedirs(dist, exist_ok=True)
    out = os.path.join(dist, "site-label-%s.zip" % version)

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for rel in INCLUDE:
            archive.write(os.path.join(ROOT, rel), rel)

    print("built %s (%d files, %.1f KB)" % (out, len(INCLUDE), os.path.getsize(out) / 1024.0))


if __name__ == "__main__":
    main()
