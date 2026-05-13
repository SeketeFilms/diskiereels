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

Never commit signing secrets. Create a local file `.env.local` in the project
root (already git-ignored) with:

```bash
ANDROID_KEYSTORE_PATH="/Users/you/keystores/diskiereels-release.jks"
ANDROID_KEYSTORE_PASSWORD="••••••••"
ANDROID_KEY_ALIAS="diskiereels"
ANDROID_KEY_PASSWORD="••••••••"
```

Load it into your shell before building:

```bash
set -a && source .env.local && set +a
```

The build script (`scripts/build-android.sh`) refuses to run unless all four
variables are present, so signing values are never hard-coded into the repo.

---

## 5. One-Command Build (APK + AAB)

```bash
bash scripts/build-android.sh        # builds both signed APK and AAB
bash scripts/build-android.sh apk    # APK only
bash scripts/build-android.sh aab    # AAB only (Play Store)
```

What it does:
1. Validates signing env vars
2. `npm run build` (Vite production bundle → `dist/`)
3. `npx cap add android` (first time) + `npx cap sync android`
4. `./gradlew assembleRelease` and/or `bundleRelease` with injected signing
5. Verifies the `.apk` / `.aab` files exist and prints their absolute paths + sizes

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

# Reset Gradle cache if builds get weird
cd android && ./gradlew clean && cd ..
```

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
