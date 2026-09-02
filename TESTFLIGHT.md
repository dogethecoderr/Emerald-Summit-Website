# Deploying Emerald Summit to TestFlight

The app is scaffolded, builds in release mode, and runs. These are the
remaining steps that require **your Apple credentials** — they can't be
automated for you.

## Prerequisites
- **Apple Developer Program membership** ($99/yr) — enroll at
  https://developer.apple.com/programs/ if you haven't.
- Xcode signed in with your Apple ID: Xcode → Settings → Accounts → **+**.

Current bundle identifier: `com.emeraldsummit.emeraldSummit`
(change it in Xcode if you want a different one — it must be unique across
the App Store).

## 1. Create the app record in App Store Connect
1. Go to https://appstoreconnect.apple.com → **Apps** → **+** → **New App**.
2. Platform: iOS. Name: **Emerald Summit**. Primary language: English.
3. Bundle ID: select `com.emeraldsummit.emeraldSummit` (register it first at
   https://developer.apple.com/account/resources/identifiers if it's not listed).
4. SKU: any unique string, e.g. `emeraldsummit01`. Create.

## 2. Configure signing in Xcode
Open the workspace (not the .xcodeproj):

```bash
open ios/Runner.xcworkspace
```

1. Select the **Runner** project → **Runner** target → **Signing & Capabilities**.
2. Check **Automatically manage signing**.
3. Set **Team** to your Apple Developer team.
4. Confirm the bundle identifier matches the app record above.

## 3. Set the version and build number
- In **General**, set Version (e.g. `1.0.0`) and Build (e.g. `1`).
- These map to `version: 1.0.0+1` in `pubspec.yaml`. Bump the number after
  `+` for every new upload (App Store Connect rejects duplicate build numbers).

## 4. Archive and upload
Two options — pick one.

### Option A: Xcode (recommended for the first time)
1. In the toolbar, set the run destination to **Any iOS Device (arm64)**.
2. Menu: **Product → Archive**. Wait for it to build.
3. In the Organizer window that opens: **Distribute App → TestFlight (Internal
   testing) → Upload**. Follow the prompts (keep default signing options).

### Option B: command line
```bash
flutter build ipa
```
Then upload `build/ios/ipa/*.ipa` using **Transporter** (free on the Mac App
Store) or:
```bash
xcrun altool --upload-app -f build/ios/ipa/emerald_summit.ipa -t ios \
  --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>
```
(command-line upload needs an App Store Connect API key configured first).

## 5. Test on TestFlight

First, in App Store Connect → your app → **TestFlight**, wait for the build to
finish **Processing** (a few minutes; you'll get an email when it's done).

You have two ways to hand the app out. As an individual developer you'll use
**External Testing** to share a link with friends — that's the path below.

### 5a. (Optional) Try it yourself first — Internal Testing
No Apple review, available immediately.
1. TestFlight tab → **Internal Testing** → **+** next to Testers.
2. Add your own Apple ID (as the account holder you're already on the team).
3. Install the **TestFlight** app on your iPhone, sign in with the same Apple
   ID, and the build appears there to install. Good for a sanity check before
   you invite anyone.

### 5b. Share a public link with friends — External Testing
This is what lets people who are **not** on your developer account install the
app. It requires a one-time **Beta App Review** by Apple (usually ~24 hours,
sometimes faster). You do **not** need an organization — individual accounts
can do external testing.

1. **Fill in Test Information** (TestFlight tab → **Test Information** in the
   left sidebar). External testing won't start until these are filled:
   - **Beta App Description** — one or two lines on what the app is.
   - **Feedback email** — where tester feedback goes (your email is fine).
   - **What to Test** — a short note, e.g. "Browse the six disciplines, add
     sessions to your schedule, check the announcements feed."
   - **Contact info** for the review (name, email, phone).
2. **Create an external group**: TestFlight tab → under **External Testing**
   click **+** → name it e.g. `Friends & Family` → Create.
3. **Attach the build**: open the group → **Builds** → **+** → pick your
   processed build. Answer the **export compliance** prompt here if asked
   (this app uses no non-standard encryption → **No**).
4. **Submit for Beta App Review**: after adding the build the group shows a
   **Submit for Review** button. Submit it. Status goes to *Waiting for
   Review* → *In Review* → *Approved*. You'll get an email at each step.
5. **Turn on the Public Link**: in the group, find **Public Link** → **Enable
   Public Link**. You get a URL like `https://testflight.apple.com/join/XXXXXXXX`.
   - Optionally set a **tester limit** (up to 10,000).
   - **Send this link to your friends.** Anyone who taps it installs the
     TestFlight app (if they don't have it), then installs your build — no
     need for you to collect their emails or add them one by one.

> You only need to pass Beta App Review once for the app. Later builds are
> usually available to external testers immediately, unless a build adds
> significant new features (then Apple may re-review).

## Notes
- **Individual accounts can do external testing** — no organization required.
- Internal testers (up to 100, must be on your account/team) need **no App
  Review** and get builds instantly — but they must be Apple IDs you add in
  App Store Connect, so this doesn't work for outside friends.
- External testers: up to **10,000**, via emailed invite or the **public
  link**. Requires **Beta App Review** on the first build.
- Each uploaded build expires after **90 days**; upload a new build (bump the
  number after `+` in `pubspec.yaml`) to refresh it.
- First upload also asks for an export-compliance answer; this app uses no
  non-standard encryption, so the usual answer is **No**. (You can set
  `ITSAppUsesNonExemptEncryption` to `false` in `ios/Runner/Info.plist` to
  stop being asked every time.)
