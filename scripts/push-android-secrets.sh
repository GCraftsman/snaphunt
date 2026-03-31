#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# push-android-secrets.sh
# One-time script: pushes Android signing secrets to the GCraftsman/snaphunt
# GitHub repo using the GitHub CLI (gh).
#
# Prerequisites:
#   1. Install gh CLI  →  https://cli.github.com
#   2. Authenticate   →  gh auth login  (use the GITHUB_SNAPHUNT_WORKFLOWS_ACCESS_TOKEN)
#   3. Copy the four values from your Replit environment variables (Secrets tab):
#        ANDROID_KEYSTORE_B64   →  paste into KEYSTORE_B64 below
#        ANDROID_KEYSTORE_PASS  →  paste into KEYSTORE_PASS below
#        ANDROID_KEY_ALIAS      →  already set to "snaphunt"
# ─────────────────────────────────────────────────────────────────────────────

REPO="GCraftsman/snaphunt"

# ── Fill these in from your Replit environment variables ──────────────────────
KEYSTORE_B64="${ANDROID_KEYSTORE_B64:-PASTE_KEYSTORE_B64_HERE}"
KEYSTORE_PASS="${ANDROID_KEYSTORE_PASS:-PASTE_KEYSTORE_PASS_HERE}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-snaphunt}"
# ─────────────────────────────────────────────────────────────────────────────

if [[ "$KEYSTORE_B64" == "PASTE_KEYSTORE_B64_HERE" ]]; then
  echo "ERROR: Please set KEYSTORE_B64 (from Replit's ANDROID_KEYSTORE_B64 env var)."
  exit 1
fi

echo "Setting GitHub secrets for $REPO …"

echo "$KEYSTORE_B64"   | gh secret set KEYSTORE_BASE64   -R "$REPO" --stdin && echo "✓ KEYSTORE_BASE64"
echo "$KEYSTORE_PASS"  | gh secret set KEYSTORE_PASSWORD -R "$REPO" --stdin && echo "✓ KEYSTORE_PASSWORD"
echo "$KEY_ALIAS"      | gh secret set KEY_ALIAS         -R "$REPO" --stdin && echo "✓ KEY_ALIAS"
echo "$KEYSTORE_PASS"  | gh secret set KEY_PASSWORD      -R "$REPO" --stdin && echo "✓ KEY_PASSWORD"

echo ""
echo "Done! Trigger the Android build at:"
echo "  https://github.com/$REPO/actions/workflows/build-android.yml"
