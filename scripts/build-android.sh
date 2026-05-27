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
#   bash scripts/build-android.sh --dry-run         # preflight + print plan, no build

set -euo pipefail

CLEAN=0
DRY_RUN=0
TARGET="all"
for arg in "$@"; do
  case "$arg" in
    --clean|-c) CLEAN=1 ;;
    --dry-run|-n) DRY_RUN=1 ;;
    apk|aab|all) TARGET="$arg" ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
AAB_PATH="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

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

# ---------- 2. Preflight: tools + Java + Gradle wrapper ----------
echo ""
echo "================ PREFLIGHT ================"
preflight_status=0

check_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "✅ $cmd: $("$cmd" -help 2>&1 | head -n1 || echo found)"
  else
    echo "❌ $cmd not found in PATH"
    preflight_status=1
  fi
}
check_cmd keytool
check_cmd jarsigner

if command -v java >/dev/null 2>&1; then
  JAVA_VER=$(java -version 2>&1 | head -n1)
  echo "✅ java: $JAVA_VER"
  JAVA_MAJOR=$(java -version 2>&1 | awk -F'"' '/version/ {print $2}' | awk -F'.' '{print ($1=="1")?$2:$1}')
  if [ "${JAVA_MAJOR:-0}" -lt 17 ]; then
    echo "❌ Java 17+ required (found $JAVA_MAJOR). Install Temurin 17."
    preflight_status=1
  fi
else
  echo "❌ java not found in PATH"
  preflight_status=1
fi

if [ -x "$ANDROID_DIR/gradlew" ]; then
  if (cd "$ANDROID_DIR" && ./gradlew --version >/dev/null 2>&1); then
    GRADLE_VER=$(cd "$ANDROID_DIR" && ./gradlew --version 2>/dev/null | awk '/^Gradle /{print $2; exit}')
    echo "✅ Gradle wrapper: $GRADLE_VER"
  else
    echo "❌ Gradle wrapper present but failed to run (./gradlew --version)"
    preflight_status=1
  fi
else
  echo "ℹ️  Gradle wrapper not present yet — will appear after 'npx cap add android'"
fi

if [ "$preflight_status" -ne 0 ]; then
  echo "==========================================="
  echo "❌ Preflight failed. Fix the issues above and re-run."
  exit 1
fi
echo "==========================================="

# ---------- 3. Print keystore certificate fingerprint ----------
echo ""
echo "================ KEYSTORE FINGERPRINT ================"
keytool -list -v \
  -keystore "$ANDROID_KEYSTORE_PATH" \
  -alias "$ANDROID_KEY_ALIAS" \
  -storepass "$ANDROID_KEYSTORE_PASSWORD" \
  | grep -E "Alias name|Owner|SHA1:|SHA256:|Valid from" || true
echo "======================================================"

# ---------- 4. Dry-run: print plan & exit ----------
if [ "$DRY_RUN" -eq 1 ]; then
  echo ""
  echo "================ DRY RUN PLAN ================"
  echo "Target:           $TARGET"
  echo "Clean first:      $([ $CLEAN -eq 1 ] && echo yes || echo no)"
  echo "Root dir:         $ROOT_DIR"
  echo "Android dir:      $ANDROID_DIR"
  echo "Expected APK out: $APK_PATH"
  echo "Expected AAB out: $AAB_PATH"
  echo "Expected alias:   $ANDROID_KEY_ALIAS"
  echo ""
  echo "Steps that WOULD run:"
  echo "  1) npm run build"
  echo "  2) [ -d android ] || npx cap add android"
  echo "  3) npx cap sync android"
  [ $CLEAN -eq 1 ] && echo "  4) ./gradlew clean"
  [ "$TARGET" = "all" ] || [ "$TARGET" = "apk" ] && echo "  5) ./gradlew assembleRelease (signed)"
  [ "$TARGET" = "all" ] || [ "$TARGET" = "aab" ] && echo "  6) ./gradlew bundleRelease (signed)"
  echo "  7) jarsigner -verify + alias match check"
  echo "  8) sha256sum of artifacts"
  echo "=============================================="
  echo "✅ Dry-run OK — no build performed."
  exit 0
fi

# ---------- 5. Web build ----------
echo "📦 Building web assets..."
cd "$ROOT_DIR"
npm run build

# ---------- 6. Capacitor sync ----------
if [ ! -d "$ANDROID_DIR" ]; then
  echo "📱 Adding Android platform..."
  npx cap add android
fi
echo "🔄 Syncing Capacitor..."
npx cap sync android

# ---------- 7. Gradle build ----------
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

if [ "$TARGET" = "all" ] || [ "$TARGET" = "apk" ]; then
  echo "🔨 Building signed APK..."
  ./gradlew assembleRelease "${GRADLE_ARGS[@]}"
fi
if [ "$TARGET" = "all" ] || [ "$TARGET" = "aab" ]; then
  echo "🔨 Building signed AAB..."
  ./gradlew bundleRelease "${GRADLE_ARGS[@]}"
fi

# ---------- 8. Validate outputs + verify signature + alias match + checksums ----------
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
  local size
  size=$(du -h "$path" | cut -f1)

  if ! jarsigner -verify "$path" >/dev/null 2>&1; then
    echo "❌ $label: signature INVALID at $path"
    status=1
    return
  fi

  # Expected alias match
  local verbose
  verbose=$(jarsigner -verify -verbose -certs "$path" 2>/dev/null || true)
  if echo "$verbose" | grep -qiE "^[[:space:]]*signed by .*$ANDROID_KEY_ALIAS|alias: ?$ANDROID_KEY_ALIAS|^$ANDROID_KEY_ALIAS$"; then
    alias_ok=1
  else
    # Cross-check via SHA256 of signing cert vs keystore
    local apk_sha keystore_sha
    apk_sha=$(echo "$verbose" | awk '/SHA-256/{print $NF; exit}' | tr -d ':')
    keystore_sha=$(keytool -list -v -keystore "$ANDROID_KEYSTORE_PATH" \
      -alias "$ANDROID_KEY_ALIAS" -storepass "$ANDROID_KEYSTORE_PASSWORD" 2>/dev/null \
      | awk -F': ' '/SHA256:/{print $2; exit}' | tr -d ': ')
    if [ -n "$apk_sha" ] && [ "${apk_sha,,}" = "${keystore_sha,,}" ]; then
      alias_ok=1
    else
      alias_ok=0
    fi
  fi

  local sha256
  sha256=$(sha256sum "$path" | awk '{print $1}')

  if [ "${alias_ok:-0}" -eq 1 ]; then
    echo "✅ $label"
    echo "   path:    $path"
    echo "   size:    $size"
    echo "   alias:   $ANDROID_KEY_ALIAS (matches expected)"
    echo "   sha256:  $sha256"
  else
    echo "❌ $label signed with UNEXPECTED alias (expected: $ANDROID_KEY_ALIAS)"
    echo "   path:    $path"
    echo "   sha256:  $sha256"
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
