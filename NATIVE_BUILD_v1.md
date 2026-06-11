# DiskieReels v1.0.0 — Native Build Guide

The `android/` and `ios/` folders aren't checked into this repo (Capacitor generates them locally). Run these steps on your machine after pulling the latest code.

## 1. Sync code & native projects

```bash
git pull
npm install
npm run build
# First time only:
npx cap add android
npx cap add ios   # macOS only
# Every time after:
npx cap sync
```

## 2. Android — set version & permissions

Open `android/app/build.gradle` and set:

```gradle
defaultConfig {
    applicationId "app.lovable.e97ab73c05cf482e9177c2c702a4a0b7"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 1
    versionName "1.0.0"
}
```

Open `android/app/src/main/AndroidManifest.xml` and paste these permissions **inside `<manifest>` above `<application>`**:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="29" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

Replace your launcher icons with the new ones generated in `public/`:
- `icon-48.png` → `android/app/src/main/res/mipmap-mdpi/ic_launcher.png`
- `icon-72.png` → `mipmap-hdpi/ic_launcher.png`
- `icon-96.png` → `mipmap-xhdpi/ic_launcher.png`
- `icon-144.png` → `mipmap-xxhdpi/ic_launcher.png`
- `icon-192.png` → `mipmap-xxxhdpi/ic_launcher.png`
- `icon-512.png` → Play Store listing icon
- (Repeat for `ic_launcher_round.png` and `ic_launcher_foreground.png`.)

Easier: install `cordova-res` and run:
```bash
npm i -g @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor "#E63946" --iconBackgroundColorDark "#E63946" --assetPath public/icon-512.png
```

## 3. iOS — usage strings & version

Open `ios/App/App/Info.plist` and add inside `<dict>`:

```xml
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
<key>CFBundleVersion</key>
<string>1</string>

<key>NSCameraUsageDescription</key>
<string>DiskieReels needs camera access so you can record reels.</string>
<key>NSMicrophoneUsageDescription</key>
<string>DiskieReels needs microphone access to record audio with your reels.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>DiskieReels needs photo library access so you can pick reels and images to upload.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>DiskieReels needs permission to save downloaded reels to your photo library.</string>
```

## 4. Build the binaries

```bash
# Android — debug APK
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk

# Android — release AAB (Play Store)
./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab

# iOS — open Xcode and Product → Archive
cd ../ios/App && open App.xcworkspace
```

Version is now **1.0.0 (build 1)**.
