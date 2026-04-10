# ToonlyReels Android APK Build Guide

This guide walks you through building the ToonlyReels Android APK for distribution.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Android Studio** (latest version) - [Download](https://developer.android.com/studio)
- **Git** - [Download](https://git-scm.com/)
- **Java JDK 17** - Usually included with Android Studio

## Step 1: Clone the Repository

```bash
git clone <your-github-repo-url>
cd <project-folder>
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Add Android Platform

If this is your first time building:

```bash
npx cap add android
```

## Step 4: Prepare for Production Build

**CRITICAL:** Before building for production/Play Store, you must modify `capacitor.config.ts`:

### Remove the Server Block

Open `capacitor.config.ts` and **remove or comment out** the entire `server` block:

```typescript
// REMOVE THIS BLOCK FOR PRODUCTION:
// server: {
//   url: 'https://e97ab73c-05cf-482e-9177-c2c702a4a0b7.lovableproject.com?forceHideBadge=true',
//   cleartext: true
// },
```

Your production config should look like:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e97ab73c05cf482e9177c2c702a4a0b7',
  appName: 'ToonlyReels',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 4000,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
```

## Step 5: Build the Web App

```bash
npm run build
```

This creates the `dist` folder with your compiled web assets.

## Step 6: Sync to Android

```bash
npx cap sync android
```

This copies your web build to the Android project and updates dependencies.

## Step 7: Open in Android Studio

```bash
npx cap open android
```

This opens the Android project in Android Studio.

## Step 8: Build the APK

### Option A: Debug APK (for testing)

In Android Studio:
1. Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for the build to complete
3. Click **locate** in the notification to find the APK

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option B: Signed Release APK (for Play Store)

1. Go to **Build** → **Generate Signed Bundle / APK**
2. Select **APK** and click **Next**
3. Create a new keystore or use existing one:
   - **Key store path**: Choose location to save
   - **Password**: Create a strong password
   - **Key alias**: e.g., `toonlyreels-key`
   - **Key password**: Create a strong password
   - **Validity**: 25 years (recommended)
   - Fill in certificate information
4. Click **Next**
5. Select **release** build variant
6. Check both **V1** and **V2** signature versions
7. Click **Finish**

Release APK location: `android/app/build/outputs/apk/release/app-release.apk`

## Step 9: Test the APK

### On Emulator:
1. Drag and drop the APK onto the running emulator

### On Physical Device:
1. Enable **Developer Options** on your device
2. Enable **USB Debugging**
3. Connect via USB
4. Transfer the APK and install, OR run:
   ```bash
   adb install path/to/app-debug.apk
   ```

## Quick Reference Commands

```bash
# Full build process
npm install
npm run build
npx cap sync android
npx cap open android

# After code changes, just run:
npm run build
npx cap sync android
```

## Troubleshooting

### Build fails with Gradle errors
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### App shows blank screen
- Ensure you ran `npm run build` before syncing
- Check that `dist` folder exists and contains files

### App connects to wrong server
- Make sure `server` block is removed from `capacitor.config.ts` for production

### Keystore issues
- Never lose your keystore file - you cannot update apps without it
- Store keystore password securely

## Important Notes

⚠️ **Keep your keystore safe!** You need the same keystore to update your app on the Play Store.

⚠️ **For development/testing**, keep the `server` block to enable hot-reload from Lovable.

⚠️ **For production builds**, always remove the `server` block so the app uses local bundled assets.

## App Details

- **App ID**: `app.lovable.e97ab73c05cf482e9177c2c702a4a0b7`
- **App Name**: ToonlyReels
- **Min SDK**: 22 (Android 5.1)
- **Target SDK**: 34 (Android 14)
