# Launch Guide for Mess Manager

This guide explains how to run the Mess Manager app on your mobile device (e.g., Samsung S23) using a USB connection.

## Prerequisites
- **Node.js** and **npm** installed
- **Expo CLI** installed globally (`npm install -g expo-cli`)
- **Android device** (Samsung S23) with USB debugging enabled
- **USB cable** to connect your phone
- **Expo Go** app installed on your phone (from Google Play Store)

## Steps to Launch the App

1. **Connect your phone via USB**
   - Enable Developer Options and USB Debugging on your S23:
     - Go to *Settings > About phone > Software information* and tap *Build number* 7 times to enable Developer Options.
     - Go to *Settings > Developer options* and enable *USB debugging*.
   - Connect your phone to your computer with a USB cable.

2. **Start the development server**
   - Open a terminal in the project root folder.
   - Run:
     ```sh
     npx expo start
     ```
   - This will open the Expo Dev Tools in your browser.

3. **(Optional) Use Reverse TCP for USB Debugging**
   If your phone and computer are not on the same Wi-Fi, or you want to use USB for a more stable connection:
   - Make sure you have Android Platform Tools (adb) installed. If not, download from https://developer.android.com/tools/releases/platform-tools
   - In your terminal, run:
     ```sh
     adb devices
     ```
     to verify your device is detected.
   - Then run:
     ```sh
     adb reverse tcp:8081 tcp:8081
     ```
     This forwards your computer's port 8081 (Metro/Expo server) to your phone over USB.
   - Now, launch the app as usual from Expo Go or with "Run on Android device/emulator".

3. **Run the app on your device**
   - Open the Expo Go app on your phone.
   - In Expo Dev Tools, click on **"Run on Android device/emulator"**.
   - If your device is detected, the app will launch on your phone.
   - Alternatively, scan the QR code shown in Expo Dev Tools with the Expo Go app.

## Troubleshooting
- If your device is not detected, ensure USB debugging is enabled and the phone is unlocked.
- You may need to allow USB debugging permissions on your phone when prompted.
- If you have issues, try running:
  ```sh
  adb devices
  ```
  to verify your device is listed.

---

For more details, see the [Expo documentation](https://docs.expo.dev/get-started/installation/) or ask for help.
