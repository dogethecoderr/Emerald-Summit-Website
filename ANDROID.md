# Android builds & sharing the APK

The app builds and runs on Android from the same Flutter codebase.

## The shareable APK
The file to send to friends:

```
build/app/outputs/flutter-apk/app-release.apk   (~49 MB, universal)
```

A copy with a friendlier name lives at the project root:
`EmeraldSummit-v1.0.0.apk`. It's a **universal** APK, so it runs on any
Android phone regardless of chip.

## Rebuild the APK
```bash
flutter build apk --release
```
Output: `build/app/outputs/flutter-apk/app-release.apk`.

(Smaller, per-chip APKs: `flutter build apk --release --split-per-abi` —
gives `app-arm64-v8a-release.apk` etc., ~15–20 MB each. Universal is simpler
to share; split is smaller but you have to pick the right one per phone.)

## Install on a USB-connected phone
1. On the phone: Settings → About phone → tap **Build number** 7× to unlock
   Developer options, then Settings → Developer options → enable **USB
   debugging**.
2. Plug in over USB and accept the **Allow USB debugging?** prompt (tick
   "Always allow from this computer").
3. Install:
   ```bash
   flutter install          # or: adb install -r build/app/outputs/flutter-apk/app-release.apk
   ```

## How your friends install it (no developer account needed)
Send them the `.apk` file (AirDrop won't work to Android — use Google Drive,
email, WhatsApp, Telegram, etc.). On their phone:

1. Tap the downloaded `.apk`.
2. Android will say the app is from an **unknown source** / ask to allow this
   app to install unknown apps — tap **Settings → allow**, then back and
   **Install**. (This is normal for any app not from the Play Store.)
3. **Play Protect** may pop up a "scan / unsafe app" warning because the app
   isn't from the Play Store. They can tap **More details → Install anyway**
   (or "Install without scanning"). This is expected for sideloaded apps.

### Note on signing
This APK is signed with Flutter's **debug key** (the default for
`flutter build apk --release` when no keystore is configured). That's fine for
sideloading to friends. If you ever publish to the Google Play Store, you'll
need to create your own upload keystore and configure release signing — that's
a later step, separate from sideloading.

## Android SDK setup (already done on this machine)
For reference, the toolchain was set up with:
- Android command-line tools: `brew install --cask android-commandlinetools`
- SDK 36 packages via `sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"`
- JDK from Android Studio's bundled runtime (JDK 21), pointed at with
  `flutter config --jdk-dir`
- `flutter config --android-sdk /opt/homebrew/share/android-commandlinetools`
- `flutter doctor --android-licenses`
