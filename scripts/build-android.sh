#!/usr/bin/env bash
# build-android.sh
# Builds web assets, syncs Capacitor, and produces a signed APK and AAB.
#
# Required env vars (see .env.example):
#   ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD,
#   ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
#
# Usage:
#   bash scripts/build-android.sh                   # build APK + AAB
#   bash scripts/build-android.sh apk               # APK only
#   bash scripts/build-android.sh aab               # AAB only
#   bash scripts/build-android.sh all --clean       # clean Gradle cache first
#   bash scripts/build-android.sh --clean           # same (target defaults to all)

set -euo pipefail

CLEAN=0
TARGET="all"
for arg in "$@"; do
  case "$arg" in
    --clean|-c) CLEAN=1 ;;
    apk|aab|all) TARGET="$arg" ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

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
  echo "Copy .env.example to .env.local, fill it in, then run:"
  echo "  set -a && source .env.local && set +a"
  exit 1
fi
if [ ! -f "$ANDROID_KEYSTORE_PATH" ]; then
  echo "❌ Keystore not found at: $ANDROID_KEYSTORE_PATH"
  exit 1
fi
echo "✅ Signing env validated"

# ---------- 2. Print keystore certificate fingerprint ----------
echo ""
echo "================ KEYSTORE FINGERPRINT ================"
keytool -list -v \
  -keystore "$ANDROID_KEYSTORE_PATH" \
  -alias "$ANDROID_KEY_ALIAS" \
  -storepass "$ANDROID_KEYSTORE_PASSWORD" \
  | grep -E "Alias name|Owner|SHA1:|SHA256:|Valid from" || true
echo "======================================================"

# ---------- 3. Web build ----------
echo "📦 Building web assets..."
cd "$ROOT_DIR"
npm run build

# ---------- 4. Capacitor sync ----------
if [ ! -d "$ANDROID_DIR" ]; then
  echo "📱 Adding Android platform..."
  npx cap add android
fi
echo "🔄 Syncing Capacitor..."
npx cap sync android

# ---------- 5. Gradle build ----------
cd "$ANDROID_DIR"

if [ "$CLEAN" -eq 1 ]; then
  echo "🧹 Cleaning Gradle cache..."
  ./gradlew clean
fi

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

# ---------- 6. Validate outputs + verify signature alias ----------
echo ""
echo "================ BUILD VALIDATION ================"
status=0

verify_signed() {
  local label="$1" path="$2"
  if [ ! -f "$path" ]; then
    echo "❌ $label MISSING: expected $path"
    status=1
    return
  fi
  local size signer_alias
  size=$(du -h "$path" | cut -f1)

  # jarsigner reports the alias used to sign the archive
  signer_alias=$(jarsigner -verify -verbose -certs "$path" 2>/dev/null \
    | awk -F': ' '/^X.509|^Signed by/{print $2}' | head -n1 || true)

  # Fallback: extract from certificate Subject CN
  local subject
  subject=$(jarsigner -verify -verbose -certs "$path" 2>/dev/null \
    | grep -m1 "X.509" || true)

  if jarsigner -verify "$path" >/dev/null 2>&1; then
    echo "✅ $label: $path ($size) — signature valid"
    [ -n "$subject" ] && echo "   $subject"
  else
    echo "❌ $label: signature INVALID at $path"
    status=1
  fi
}

if [ "$TARGET" = "all" ] || [ "$TARGET" = "apk" ]; then
  verify_signed "Signed APK" "$APK_PATH"
fi
if [ "$TARGET" = "all" ] || [ "$TARGET" = "aab" ]; then
  verify_signed "Signed AAB (Play Store)" "$AAB_PATH"
fi
echo "=================================================="

exit $status
