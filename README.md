# Audito

## Audito Auditor Android App

An installable Android app for **auditors only** (shown on the device as
**Audito**), built with Capacitor from the
same Next.js pages as the website (`frontend/`). The website itself is
unchanged.

### What the app includes

- Sign in (auditor accounts only), forgot password, email verification
- Dashboard and notifications
- My Audits: list, details, preview, answering (unsaved answers stay on the
  device until saved), evidence (photo, video, voice, files), completion,
  corrective actions, reports
- My CAPs (the same set)
- AI Site Scan
- Profile, profile image and documents
- My Learning, Notices, Help

Registration, pricing, payments, organization setup, checklists, user
management and the admin, organization-user and Audito-admin screens are not
part of the app. Every other path redirects to the dashboard (or sign-in).
This only shapes the app: the API still checks every request by role.

### How it works

| Area | Behavior in the app |
| --- | --- |
| Sign-in | Sends `required_role: "auditor"` to `POST /api/auth/login`. The server signs in to the auditor account only, never another account for the same email, and marks the session `client: "auditor_app"`. The app checks the role again before storing anything. |
| Session | Tokens are stored encrypted with an Android Keystore key (`capacitor-secure-storage-plugin`), not in WebView storage. An expired access token is renewed once with the refresh token (`required_role: "auditor"`) and the request is repeated. The session is checked again on start and whenever the app returns from the background. Revoked, expired or deactivated sessions are signed out. |
| Role switching | Not available. The server refuses `switch-account` for app sessions and lists only the auditor account. |
| API address | `frontend/.env.android` (HTTPS only). The build stops when it is missing, not HTTPS, or points to localhost or the emulator host. The app never falls back to localhost or to its own origin. |
| Reports | Audit and CAP PDF reports open the Android share sheet (save to Files or Drive, or send). Files are written to the app cache and removed after an hour. No storage permission is used. The website still downloads the PDF. |
| Back button | Closes the open dialog first. On the audit and CAP execution screens it steps back through the areas and asks about unsaved answers. Otherwise it goes back, and on the dashboard or sign-in screen it leaves the app. |
| Connection | Online only. A banner shows when the connection is lost. Answers being entered stay on the device until saved, but nothing is synced offline. |
| Permissions | Internet, camera, microphone (asked for on first use). No storage permissions. Backups of app data are disabled. Cleartext HTTP is disabled. |

The WebView origin is `https://localhost`. The backend allows it in CORS
(`backend/src/server.js`), so the server the app uses must run this backend
version.

### Requirements

| Tool | Version |
| --- | --- |
| Node.js | 22 or newer (tested with 24.16) |
| JDK | 21 (tested with Temurin 21.0.12) |
| Android SDK | Platform 36, Build-tools 36.0.0, Platform-tools |
| Gradle / AGP | 8.14.3 / 8.13.0 (from the Gradle wrapper; nothing to install) |
| Capacitor | 8.5.3 (`@capacitor/core`, `cli`, `android`), plugins `app` 8.1.2, `filesystem` 8.1.4, `share` 8.0.3, `splash-screen` 8.0.2, `capacitor-secure-storage-plugin` 0.13.0 |

Android Studio is optional. `scripts/android/gradle.mjs` uses `JAVA_HOME` and
`ANDROID_HOME` when set. Otherwise it uses a user-local toolchain in
`%LOCALAPPDATA%\audito-android-toolchain\` (`jdk-21`, `sdk`), then
Android Studio's bundled JDK and default SDK.

### Build a debug APK

From `frontend/`:

```bash
npm install
npm run android:apk
```

This runs, in order:

1. `npm run android:web`: checks `.env.android`, builds the static export into
   `frontend/android-web/` (the website's `out/` is not touched), and checks
   that it contains the configured API and no secrets.
2. `cap sync android`: copies it into the Android project.
3. `gradle assembleDebug`.
4. `npm run android:verify`: unpacks the APK and checks for the API address,
   secrets, tokens, env files, source maps, keystores, live-reload settings and
   broad storage permissions.

The debug APK is at:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Install it with `adb install -r <path>`, or copy it to the device.

To change the server, edit `frontend/.env.android` and rebuild. Launcher icons
and the splash screen (the Audito logo on white) come from `public/logo.png`
(1024×1024) via `scripts/android/make-icons.ps1`. Re-run that script after
changing the logo. The splash stays up until the first screen has loaded
(`@capacitor/splash-screen` 8.0.2), or for at most 10 seconds.

### Before any release

Do not publish or distribute a release build until these are confirmed:

- **Permanent application ID.** `com.company.audito` is a placeholder. Change it
  in `capacitor.config.ts`, `android/app/build.gradle` (`namespace`,
  `applicationId`), `android/app/src/main/res/values/strings.xml`, and the
  `MainActivity` package folder.
- **Production API URL.** Set it in `.env.android`. The current value is the
  test server.
- **Signing owner**, who creates and keeps the upload keystore.
- **Release destination** (Play Console track or private distribution).

The release build refuses to run while the ID is the placeholder, while no
signing file is given, or until it is confirmed with
`-PauditoReleaseConfirmed=true`.

#### Signing

Keep the keystore and passwords **outside the repository**. `*.jks`,
`*.keystore`, `keystore.properties` and `signing.properties` are ignored by git.

1. Create the keystore once, on the signing owner's machine:

   ```bash
   keytool -genkeypair -v -keystore C:\secure\audito-auditor-upload.jks -alias audito-auditor -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Create a properties file outside the repository, for example
   `C:\secure\audito-auditor-signing.properties`:

   ```properties
   storeFile=C:/secure/audito-auditor-upload.jks
   storePassword=...
   keyAlias=audito-auditor
   keyPassword=...
   ```

3. Build (from `frontend/android/`):

   ```bash
   set AUDITO_ANDROID_SIGNING_PROPERTIES=C:\secure\audito-auditor-signing.properties
   gradlew.bat bundleRelease -PauditoReleaseConfirmed=true -PauditoVersionCode=2 -PauditoVersionName=1.0.1
   ```

   With Play App Signing, upload the `.aab` from
   `app/build/outputs/bundle/release/`. Back up the keystore and passwords.
   Losing them blocks future updates.

#### Version numbers

- `versionCode` (`-PauditoVersionCode`) is a whole number that must increase for
  every build given to users. Android refuses to update to a lower or equal
  number. The default is `1`.
- `versionName` (`-PauditoVersionName`) is the version users see, for example
  `1.0.1`. The default is `1.0.0`.

### Known limitations

- Online only: answers can be entered without a connection and stay on the
  device, but saving, uploads and reports need a connection.
- Email links (invitations, password set-up) open the website, not the app.
  After setting a password there, sign in in the app.
- Evidence links and external links open in the device browser.
