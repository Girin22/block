import type { CapacitorConfig } from '@capacitor/cli';

// The app shell around the web build in dist/. Everything ships inside the app (no remote URL), so it
// runs offline and the stores review a real app, not a wrapped website.
const config: CapacitorConfig = {
  // Permanent once the first build is uploaded to a store; never change it after that.
  appId: 'com.simulien.bodobodo',
  appName: '보도보도',
  webDir: 'dist',
  backgroundColor: '#2c2929',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never', backgroundColor: '#2c2929' },
  plugins: {
    SplashScreen: { launchShowDuration: 0, launchAutoHide: true, backgroundColor: '#2c2929', showSpinner: false },
  },
};

export default config;
