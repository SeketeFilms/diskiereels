import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for ToonlyReels / DiskieReels
 *
 * IMPORTANT — Production vs Development:
 * - For Play Store / App Store builds (APK / AAB / IPA), the `server` block
 *   below MUST stay commented out so the app loads bundled assets from `dist/`.
 * - For live-reload during development against the Lovable sandbox, uncomment
 *   the `server` block.
 *
 * Build flow (Android Studio):
 *   1. npm install
 *   2. npm run build
 *   3. npx cap sync android
 *   4. npx cap open android
 *   5. In Android Studio:
 *        - Debug APK:  Build > Build Bundle(s)/APK(s) > Build APK(s)
 *        - Release AAB (Play Store): Build > Generate Signed Bundle/APK > Android App Bundle
 */
const config: CapacitorConfig = {
  appId: 'app.lovable.e97ab73c05cf482e9177c2c702a4a0b7',
  appName: 'DiskieReels',
  webDir: 'dist',

  // 🔴 PRODUCTION: keep this commented out for Play Store builds.
  // 🟢 DEV ONLY: uncomment to live-reload from the Lovable sandbox.
  // server: {
  //   url: 'https://e97ab73c-05cf-482e-9177-c2c702a4a0b7.lovableproject.com?forceHideBadge=true',
  //   cleartext: true,
  // },

  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    buildOptions: {
      // Fill these in locally (NEVER commit a real keystore) for signed AAB builds.
      // keystorePath: 'release.keystore',
      // keystoreAlias: 'diskiereels',
      releaseType: 'AAB', // 'AAB' for Play Store, 'APK' for sideload
    },
  },

  ios: {
    contentInset: 'always',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
