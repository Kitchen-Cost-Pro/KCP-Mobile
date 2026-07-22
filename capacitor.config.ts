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
  }
};

export default config;
