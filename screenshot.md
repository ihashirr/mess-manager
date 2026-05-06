# Launch Guide for Mess Manager

...existing content...

## Taking a Screenshot with adb
To capture your Android device's screen and save it to your computer, use:

```sh
adb exec-out screencap -p > ./test/screenshot.png
```

Or, to save to the device and pull to your computer:

```sh
adb shell screencap -p /sdcard/screen.png
adb pull /sdcard/screen.png .
```

This will save the screenshot in your current directory.
