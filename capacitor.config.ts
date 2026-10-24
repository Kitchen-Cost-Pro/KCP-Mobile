import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kitchencostpro.mobile',
  appName: 'KCP Lite',
  webDir: 'dist',
  backgroundColor: '#071223',
  server: {
    androidScheme: 'https',
    hostname: 'localhost'
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#071223'
  },
  ios: {
    backgroundColor: '#071223',
    contentInset: 'automatic'
  },
  plugins: {
    // Live updates are driven from src/core/updates against KCP's own manifest host.
    // Automatic Capgo cloud checks and statistics are switched off.
    CapacitorUpdater: {
      autoUpdate: false,
      appReadyTimeout: 15000,
      resetWhenUpdate: true,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      statsUrl: '',
      shakeMenu: false,
      allowPreview: false
    }
  }
};

export default config;
