#!/usr/bin/env bash
# build-android.sh
# Builds web assets, syncs Capacitor, and produces a signed APK and AAB.
#
# Required environment variables (export before running, or place in a local
# .env.local file that you `source` — DO NOT commit secrets):
#   ANDROID_KEYSTORE_PATH      Absolute path to your .keystore / .jks file
#   ANDROID_KEYSTORE_PASSWORD  Keystore password
#   ANDROID_KEY_ALIAS          Key alias inside the keystore
#   ANDROID_KEY_PASSWORD       Key password (often same as keystore password)
#
# Usage:
#   bash scripts/build-android.sh           # builds both APK + AAB
#   bash scripts/build-android.sh apk       # APK only
#   bash scripts/build-android.sh aab       # AAB only

set -euo pipefail

TARGET="${1:-all}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

# ---------- 1. Validate signing env ----------
missing=()
for v in ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  if [ -z "${!v:-}" ]; then missing+=("$v"); fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "❌ Missing required env vars for release signing:"
  printf '   - %s\n' "${missing[@]}"
  echo ""
  echo "Export them in your shell or create .env.local and run:  set -a && source .env.local && set +a"
  exit 1
fi
if [ ! -f "$ANDROID_KEYSTORE_PATH" ]; then
  echo "❌ Keystore not found at: $ANDROID_KEYSTORE_PATH"
  exit 1
fi

echo "✅ Signing env validated"

# ---------- 2. Web build ----------
echo "📦 Building web assets..."
cd "$ROOT_DIR"
npm run build

# ---------- 3. Capacitor sync ----------
if [ ! -d "$ANDROID_DIR" ]; then
  echo "📱 Adding Android platform..."
  npx cap add android
fi
echo "🔄 Syncing Capacitor..."
npx cap sync android

# ---------- 4. Gradle release build ----------
cd "$ANDROID_DIR"

GRADLE_ARGS=(
  "-Pandroid.injected.signing.store.file=$ANDROID_KEYSTORE_PATH"
  "-Pandroid.injected.signing.store.password=$ANDROID_KEYSTORE_PASSWORD"
  "-Pandroid.injected.signing.key.alias=$ANDROID_KEY_ALIAS"
  "-Pandroid.injected.signing.key.password=$ANDROID_KEY_PASSWORD"
)

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
AAB_PATH="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

if [ "$TARGET" = "all" ] || [ "$TARGET" = "apk" ]; then
  echo "🔨 Building signed APK..."
  ./gradlew assembleRelease "${GRADLE_ARGS[@]}"
fi

if [ "$TARGET" = "all" ] || [ "$TARGET" = "aab" ]; then
  echo "🔨 Building signed AAB..."
  ./gradlew bundleRelease "${GRADLE_ARGS[@]}"
fi

# ---------- 5. Validate outputs ----------
echo ""
echo "================ BUILD VALIDATION ================"
status=0

check() {
  local label="$1" path="$2"
  if [ -f "$path" ]; then
    local size
    size=$(du -h "$path" | cut -f1)
    echo "✅ $label: $path ($size)"
  else
    echo "❌ $label MISSING: expected $path"
    status=1
  fi
}

if [ "$TARGET" = "all" ] || [ "$TARGET" = "apk" ]; then
  check "Signed APK" "$APK_PATH"
fi
if [ "$TARGET" = "all" ] || [ "$TARGET" = "aab" ]; then
  check "Signed AAB (Play Store)" "$AAB_PATH"
fi
echo "=================================================="

exit $status
