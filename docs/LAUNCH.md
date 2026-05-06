# Launch Guide for Mess Manager

This guide explains how to run the Mess Manager app on your mobile device (e.g., Samsung S23) using a USB connection.

## Prerequisites
- **Node.js** and **npm** installed
- Use the local Expo CLI through the project scripts. Do not install the old global `expo-cli` package.
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
     npm start
     ```
   - This starts Expo with a clean Metro cache and avoids the Expo API cache issue that can show `Body is unusable: Body has already been read`.

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
- If you still need to run Expo directly, use:
  ```powershell
  $env:EXPO_NO_CACHE="1"; npx expo start --clear
  ```

## Phone Run Log

Recorded on May 3, 2026 for the connected Samsung S23+.

1. Confirmed the phone was connected:
   ```powershell
   adb devices -l
   ```
   Device detected:
   ```text
   RZCWA0HEBJF device product:dm2qxxx model:SM_S916B device:dm2q
   ```

2. Confirmed Metro was already running on port `8081` from:
   ```powershell
   npm start
   ```

3. Forwarded Metro to the phone over USB:
   ```powershell
   adb reverse tcp:8081 tcp:8081
   ```

4. Launched the app in Expo Go on the phone:
   ```powershell
   adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
   ```

5. Verified the app was foregrounded in Expo Go:
   ```powershell
   adb shell dumpsys activity activities | findstr /i "mResumedActivity host.exp.exponent ExperienceActivity"
   ```

6. Verified the USB reverse rule:
   ```powershell
   adb reverse --list
   ```
   Expected output:
   ```text
   UsbFfs tcp:8081 tcp:8081
   ```

---

For more details, see the [Expo documentation](https://docs.expo.dev/get-started/installation/) or ask for help.
