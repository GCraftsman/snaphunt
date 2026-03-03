import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.snaphunt.app",
  appName: "SnapHunt",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
  },
  plugins: {
    Camera: {
      presentationStyle: "fullscreen",
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0a0a1a",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a1a",
    },
  },
};

export default config;
