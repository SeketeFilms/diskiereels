# DiskieReels — Android Build Guide (VS Code + Capacitor + Android Studio)

This guide walks you through producing a **signed APK** (sideload / testing) and a
**signed AAB** (Google Play Store submission) from a fresh checkout.

---

## 1. Prerequisites

Install once on your machine:

- [Node.js 18+](https://nodejs.org/)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Android Studio](https://developer.android.com/studio) (includes Android SDK + JDK 17)
- [Git](https://git-scm.com/)

Recommended VS Code extensions:
- **ESLint**, **Prettier**, **Tailwind CSS IntelliSense**
- **Ionic** (gives Capacitor command palette helpers)

Set these once in your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"   # macOS
# export ANDROID_HOME="$HOME/Android/Sdk"          # Linux
# setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"   # Windows (PowerShell)
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
```

---

## 2. Project Setup in VS Code

```bash
git clone <your-repo-url>
cd diskiereels
code .              # opens VS Code in this folder
npm install
```

Confirm `capacitor.config.ts` does **NOT** have an active `server` block
(the Lovable sandbox URL must stay commented out for production).

---

## 3. Create / Locate Your Release Keystore

If you don't already have one:

```bash
keytool -genkey -v \
  -keystore ~/keystores/diskiereels-release.jks \
  -alias diskiereels \
  -keyalg RSA -keysize 2048 -validity 10000
```

> ⚠️ **Back up this file and remember the passwords.** Losing the keystore means
> you can never publish updates to the same Play Store listing.

---

## 4. Configure Signing via Environment Variables (secure)

Never commit signing secrets. Copy the template:

```bash
cp .env.example .env.local
# then edit .env.local with your real values
```

`.env.example` (committed, no secrets):

```bash
ANDROID_KEYSTORE_PATH="/absolute/path/to/diskiereels-release.jks"
ANDROID_KEYSTORE_PASSWORD="your-keystore-password"
ANDROID_KEY_ALIAS="diskiereels"
ANDROID_KEY_PASSWORD="your-key-password"
```

Load it into your shell before building:

```bash
set -a && source .env.local && set +a
```

The build script refuses to run unless all four variables are present, so
signing values are never hard-coded into the repo.

---

## 5. One-Command Build (APK + AAB)

```bash
bash scripts/build-android.sh                # signed APK + AAB
bash scripts/build-android.sh apk            # APK only
bash scripts/build-android.sh aab            # AAB only (Play Store)
bash scripts/build-android.sh --clean        # clean Gradle cache, then build both
bash scripts/build-android.sh aab --clean    # clean + AAB only
```

What it does:
1. Validates signing env vars
2. Prints the **keystore certificate fingerprint** (alias, owner, SHA1, SHA256, validity)
3. `npm run build` (Vite production bundle → `dist/`)
4. `npx cap add android` (first time) + `npx cap sync android`
5. Optional `./gradlew clean` when `--clean` is passed
6. `./gradlew assembleRelease` and/or `bundleRelease` with injected signing
7. **Verifies** each `.apk` / `.aab` exists, runs `jarsigner -verify`, prints the signing certificate, file path, and size

Outputs:
- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

---

## 6. Manual Build via Android Studio (alternative)

If you prefer the IDE:

```bash
npm run build
npx cap sync android
npx cap open android         # launches Android Studio
```

In Android Studio:

### Signed APK
1. **Build → Generate Signed Bundle / APK…**
2. Select **APK** → **Next**
3. Choose your keystore file, enter passwords + alias → **Next**
4. Build variant: **release** → check **V1** and **V2** signatures → **Finish**
5. Output: `android/app/build/outputs/apk/release/app-release.apk`

### Signed AAB (Play Store)
1. **Build → Generate Signed Bundle / APK…**
2. Select **Android App Bundle** → **Next**
3. Same keystore + alias → **Next**
4. Build variant: **release** → **Finish**
5. Output: `android/app/build/outputs/bundle/release/app-release.aab` ← upload this to Play Console

---

## 7. Quick Reference

```bash
# Full clean build
npm install
bash scripts/build-android.sh

# After code changes
npm run build && npx cap sync android && bash scripts/build-android.sh

# Install APK to a connected device
adb install android/app/build/outputs/apk/release/app-release.apk

# Reset Gradle cache if builds get weird (built into the script)
bash scripts/build-android.sh --clean
```

---

## 7b. CI/CD — GitHub Actions

`.github/workflows/android-release.yml` runs the same script in CI. It builds
and validates a signed APK + AAB on every `v*` tag (or manual dispatch) and
uploads them as workflow artifacts.

Required GitHub repo secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Output of `base64 -i release.jks` (entire keystore, base64-encoded) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (e.g. `diskiereels`) |
| `ANDROID_KEY_PASSWORD` | Key password |

Encode your keystore once:

```bash
base64 -i ~/keystores/diskiereels-release.jks | pbcopy   # macOS
base64 -w0 ~/keystores/diskiereels-release.jks           # Linux
```

Paste the result into the `ANDROID_KEYSTORE_BASE64` secret. The workflow
decodes it to a temp path, runs the build, validates signatures, uploads
`app-release-apk` and `app-release-aab` artifacts, then deletes the keystore.

---

## 8. Play Store Submission Checklist

- [ ] Signed `app-release.aab` produced and validated
- [ ] App icon 512×512 PNG ready
- [ ] Feature graphic 1024×500 ready
- [ ] Screenshots (phone + tablet)
- [ ] Privacy Policy URL (already at `/privacy-policy`)
- [ ] Designed for Families questionnaire complete
- [ ] Content rating questionnaire complete
- [ ] Target SDK 34+ (already configured)

---

## 9. Troubleshooting

**`Missing required env vars for release signing`** — run `set -a && source .env.local && set +a` first.

**`Keystore was tampered with, or password was incorrect`** — `ANDROID_KEYSTORE_PASSWORD` is wrong.

**App shows blank screen on device** — make sure the `server` block in `capacitor.config.ts` is commented out, then rebuild.

**Gradle errors** — `cd android && ./gradlew clean && cd .. && npx cap sync android`.

---

## App Details

- **App ID**: `app.lovable.e97ab73c05cf482e9177c2c702a4a0b7`
- **App Name**: DiskieReels
- **Min SDK**: 22 (Android 5.1) · **Target SDK**: 34 (Android 14)
