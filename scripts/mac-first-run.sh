#!/usr/bin/env bash
# Clears the quarantine flag so macOS will open RetroPlaningStudio.
#
# The app carries a valid ad-hoc signature but no Apple Developer ID, so Gatekeeper rejects it
# (`spctl -a` returns "rejected"). On macOS 15 and later the right-click → Open bypass no longer
# works, so removing the quarantine attribute is the only way in short of paying for notarization.
set -euo pipefail
APP="${1:-/Applications/RetroPlaningStudio.app}"
if [ ! -d "$APP" ]; then
  echo "Not found: $APP" >&2
  echo "Usage: $0 [/path/to/RetroPlaningStudio.app]" >&2
  exit 1
fi
xattr -dr com.apple.quarantine "$APP"
echo "Quarantine cleared on $APP — it will now open normally."
codesign --verify --deep --strict "$APP" 2>/dev/null \
  && echo "Signature verified." \
  || echo "WARNING: signature did not verify; macOS may call the app damaged." >&2
