import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e97ab73c05cf482e9177c2c702a4a0b7',
  appName: 'ToonlyReels',
  webDir: 'dist',
  server: {
    url: 'https://e97ab73c-05cf-482e-9177-c2c702a4a0b7.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true
    }
  }
};

export default config;
