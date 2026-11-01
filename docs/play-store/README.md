# Google Play: listing, Play Console answers and release steps

Everything here is a draft for the developer to review and submit; nothing in
this folder is uploaded anywhere automatically. Policy facts were checked
against Google's own pages on 29 September 2026; links are given so each can
be re-checked before submitting.

## Assets in this folder

| File | Play Console field | Spec it meets |
| --- | --- | --- |
| `icon-512.png` | App icon | 512×512, 32-bit PNG with alpha, under 1 MB |
| `feature-graphic.jpg` | Feature graphic | 1024×500 JPEG, no alpha |
| `screenshots/01-garden.jpg` … `07-guide.jpg` | Phone screenshots | 1080×1920 (9:16) JPEG; 2–8 allowed, 4+ at 1080p for recommendations |

All of them are rendered from the Android build by
`scripts/play-store-assets.mjs` (instructions at the top of that file), so
they can be regenerated whenever the app changes. The garden in them is a
demonstration garden; every pixel is the real app.

Spec source: https://support.google.com/googleplay/android-developer/answer/9866151

## Store listing text

**App name** (20 / 30): The Butterfly Garden

**Short description** (76 / 80):

> Small acts of self-care grow a private butterfly garden. No account, no ads.

**Full description** (well under 4,000):

> The Butterfly Garden is a gentle, private self-care companion. Each small act
> of care — a mood check-in, a goal kept, a moment of reflection — earns
> sunlight that helps your garden grow, and a sanctuary of real butterfly
> species slowly comes to life.
>
> GROW A GARDEN WITH YOUR DAYS
> • Check in with your inner weather and keep a private journal
> • Set one-time, daily or weekday goals, and skip, snooze or plan them ahead
> • Plant host and nectar flowers, and watch eggs become caterpillars,
>   chrysalises and butterflies
> • Meet 25 real butterfly species, each with field notes and the plants they need
> • Care for your companions, dress them up, and choose how they fly
> • Seven illustrated scenes, a starry night mode, and five soundscapes made
>   on your phone
>
> PRIVATE BY DESIGN
> • No account, no ads, no analytics or tracking in the app
> • Everything you write stays on your phone and is never uploaded
> • Works fully offline
> • Save a backup file wherever you choose, and restore it any time
>
> THE GARDEN PASS (OPTIONAL)
> The Garden Pass is an optional subscription through Google Play that adds
> seasonal outfits, extra scenes and your own images as garden backdrops.
> Everything else in the garden is free. The subscription renews automatically
> until you cancel it in Google Play.
>
> A NOTE ON WELLBEING
> The Butterfly Garden is a self-care companion, not a medical device. It does
> not diagnose, treat, cure or prevent any medical condition. If you are
> struggling, please talk to a healthcare professional.

The wellbeing note is there because Google's Health apps policy asks health and
wellness apps to state it in the description:
https://support.google.com/googleplay/android-developer/answer/16679511

**Category:** Lifestyle is the safer choice. Health & Fitness also fits, but
see the Health apps declaration below.

**Privacy policy URL:** https://dionnedeh.github.io/The-Butterfly-Garden/privacy.html
(live, and redeployed with each release). The same page is inside
the app under Settings → About → Privacy policy, which Play also requires:
https://support.google.com/googleplay/android-developer/answer/10144311

## Play Console declarations (drafts)

**App access:** all functionality is available without special access (no
login).

**Ads:** the app contains no ads.

**Content rating (IARC questionnaire):** category "all other app types";
answer "no" to violence, sexuality, language, controlled substances and
gambling; users cannot interact with or share content with each other; no
location sharing; digital purchases: yes (an in-app subscription). Expect the
lowest ratings (Everyone / PEGI 3), but the questionnaire decides.

**Target audience:** 13 and over (13–15, 16–17, 18+). Including any group
under 13 brings the whole Families policy in. Google may also question a
listing whose art looks child-directed, so answer the "appeals to children"
question honestly: https://support.google.com/googleplay/android-developer/answer/9867159

**Health apps declaration:** required of every app. The closest fit is
Health and fitness → "Stress Management, Relaxation, Mental Acuity". Avoid the
Medical group's "Mental and Behavioral Health": Play's account rules say
health apps such as medical apps need an organisation account, and this app
makes no medical claims. https://support.google.com/googleplay/android-developer/answer/14738291

**Data safety** (re-checked against the code on 1 November 2026):
- The app's own code collects nothing: "collect" means sending data off the
  device, and the journal, moods, goals, garden and images never leave it,
  nor do the field book's sightings and photos, the comfort plan's names and
  phone numbers, the region and hemisphere, or the garden lock's record.
  https://support.google.com/googleplay/android-developer/answer/10787469
- What the gardener sends on their own is not collected by the app: a
  backup, a protected backup, a move file or the year's postcard goes only
  where they choose on Android's save screen; a daily calendar visit opens
  the calendar's own new-event screen with fixed text ("Garden time 🦋", the
  time, a daily repeat, how to open the garden or stop the reminders) and is
  added only if they save it there, or, without such a screen, is a calendar
  file they save; the support page's and the comfort
  plan's numbers open the dialler or the messages app; helpline and
  nature-count links open the browser. None of it reaches the developer or
  an SDK in the app.
- Permissions: the app asks for none to reach the camera, photos, location,
  contacts or calendar. Photos come through Android's own picker and the
  calendar visit through the calendar app's own screen. Check the release
  bundle's merged manifest before answering; builds made on 26 and 27
  October 2026 listed only INTERNET, ACCESS_NETWORK_STATE and Play's
  BILLING, plus AndroidX's own receiver permission.
- The garden lock and protected backups encrypt on the device. They are not
  "encryption in transit" and change no answer here.
- Payment details are collected by Google Play directly and need not be
  declared.
- **Google Play Billing Library is an SDK inside the app that reports to
  Google** (it bundles Google's datatransport logger). The app only wakes it
  when the gardener opens the Garden Pass, subscribes, manages it in Google
  Play or has a Pass, but
  whatever it sends counts as collection by an SDK in your app. Before
  answering, open the library's entry in Play SDK Index
  (https://play.google.com/sdks) and declare what it lists. If it lists
  nothing, "No data collected" is accurate.
- Encrypted in transit: yes (Google's libraries use HTTPS). Deletion: data
  lives only on the device; Settings → Delete all local data removes it, with
  its earlier copies, drafts and lock.

**EEA digital content or service:** the Garden Pass is continuing access to
features, which reads as a digital *service*; confirm with Play's definitions:
https://support.google.com/googleplay/android-developer/answer/10463498

**Government, financial, news, health research:** none apply.

## Things Google displays or requires of the developer

- **Closed test before production** (personal accounts created after
  13 Nov 2023): at least 12 testers opted in for 14 continuous days.
  https://support.google.com/googleplay/android-developer/answer/14151465
- **Public contact details:** once an app sells anything, Play shows the
  developer's legal name, full address and email on the listing.
  https://support.google.com/googleplay/android-developer/answer/13628312
- **Device verification** for new personal accounts: sign in to the Play
  Console app on a real, non-rooted Android 10+ phone.
  https://support.google.com/googleplay/android-developer/answer/14316361
- **Service fee** on auto-renewing subscriptions: 15% (in the EEA, UK and US
  from 30 June 2026, 10% + a 5% billing fee). Google collects and remits VAT
  or sales tax in the EU, UK, most US states and many other countries.
  https://support.google.com/googleplay/android-developer/answer/112622 ·
  https://support.google.com/googleplay/android-developer/answer/138000

## Release steps

Before each release, check every number on the support page
(`src/data/support.ts`) on the service's own site, then set
`SUPPORT_CHECKED_ON` to that day: `npm test` fails once a release is dated
(`releasedOn`) more than 30 days after it.

1. **Create the upload key** on your own computer (any Java install, or
   Android Studio's `jbr/bin/keytool`), and back up the file and password:

   ```
   keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
   ```

2. **Store it in GitHub, never in the repository or a chat.** Settings →
   Environments → New environment `play-release` → Deployment branches:
   *Selected branches* → `main` (and, optionally, Required reviewers: you).
   Add four environment secrets:
   - `BG_UPLOAD_KEYSTORE_BASE64`: the file as base64 (`base64 -w0 upload.jks`
     on Linux, `base64 -i upload.jks` on macOS, or in PowerShell
     `[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks"))`)
   - `BG_UPLOAD_KEYSTORE_PASSWORD`, `BG_UPLOAD_KEY_ALIAS` (`upload`),
     `BG_UPLOAD_KEY_PASSWORD`
3. **Build:** Actions → Android app → Run workflow (on `main`). The run's
   artifacts hold `app-release.aab` (for Play) and `app-release.apk`; they
   are kept for three days.
4. **Play Console:** create the app (App, Free, with in-app purchases); fill
   in the declarations above; upload the `.aab` to Internal testing. New apps
   use Play App Signing: Google holds the app signing key and your upload key
   only proves uploads are yours.
5. **Licence key:** Monetize with Play → Monetization setup → Licensing.
   It is a public key; paste it in chat or into
   `android/app/src/main/res/values/garden_pass.xml`. Until it is there the
   app says the Pass is not set up and grants nothing.
6. **Subscription:** Monetize → Subscriptions → create `garden_pass`, with
   auto-renewing base plans `monthly` and `yearly`, your prices, and
   optionally a free-trial offer for new subscribers. Play's grace period
   and account hold defaults are fine: during a grace period Play still
   reports the purchase, so the Pass stays open; during account hold the app
   asks Play for suspended subscriptions too, closes the Pass and tells the
   gardener to fix the payment in Google Play.
7. **License testers:** Setup → License testing. Testers buy with test
   payment methods, test subscriptions renew within minutes, and a tester
   can even buy on a sideloaded debug APK from CI as long as the package name
   matches. Google's Play Billing Lab app can force grace period or account
   hold. https://developer.android.com/google/play/billing/test
8. **Closed test** with 12+ testers for 14 days, then apply for production.

## Device test checklist

What could not be exercised in a container or a desktop browser, so needs a
real phone (ideally one recent and one older, Android 8–10):

- [ ] Launch: cream splash with the icon, then the garden; launcher icon in
      round and squircle masks; themed icon (Android 13+ wallpaper colours)
- [ ] Screen edges: header clear of the status bar and camera cutout in
      portrait and landscape; bottom navigation clear of the gesture bar;
      status-bar icons dark in sunlight mode and light in night mode
- [ ] Back gesture: closes the outfit preview and the image editor; returns
      privacy and notices to Settings, the recap to Today, other pages to the
      garden; from the garden, the app goes to the background and returns
      unchanged
- [ ] Journal and goal fields: the keyboard does not cover what is typed
- [ ] Backup: "Save a backup" opens Android's save screen; saving to
      Downloads and to Google Drive both say "Backup saved"; backing out says
      "No backup was saved"; a garden with three personal backdrops (a backup
      of several MB) saves without the app closing
- [ ] Restore: the picker can select that backup (Downloads and Drive) and
      restores it; a backup made by the web version restores too
- [ ] Personal backdrop: pick a photo, crop, save, reopen the app
- [ ] A chooser put away: in Log a sighting, type a few words, tap "Add a
      photo" and back out of the picker without choosing one; the form stays
      open with the words in it. The same for "Choose a garden image" in
      Add your own backdrop
- [ ] Soundscape stops when the app goes to the background, resumes on return
- [ ] Airplane mode: everything except the Garden Pass works
- [ ] Settings → Open-source notices: both sections open, including
      "Notices from inside Google's libraries"
- [ ] Garden Pass, as a license tester: prices shown; subscribe, cancel
      partway, slow test card → "pending" then open; manage/cancel opens Play;
      lapse after the test subscription ends → garden notice, Pass items
      hidden but nothing deleted; resubscribe from Settings → "Manage or
      cancel in Google Play" → back in the app the Pass opens by itself;
      account hold (Play Billing Lab) → "on hold", never "ended";
      reinstall → Pass returns after opening the Garden Pass page; airplane
      mode → Pass stays open (up to seven days)
- [ ] Without ever opening the Garden Pass, Settings shows "Open the Garden
      Pass to check your subscription" (Play is not asked until then)

Added for 3.1–3.4 and since:

- [ ] Garden lock: Settings → Lock my garden, with a passcode and the
      recovery code written down; "Lock now" shows the lock screen, with the
      status-bar icons readable on it in sunlight and in night mode; the back
      gesture on the lock screen leaves the app, and coming back shows the
      lock screen, never the garden; with "After 1 minute out of sight", the
      app in the background for over a minute opens to the lock screen; it
      opens with the passcode, and with the recovery code
- [ ] Protected backup: "Save a protected backup" opens Android's save screen
      and says it was saved; Restore picks that file, asks for its
      passphrase and restores it; a wrong passphrase says so and replaces
      nothing
- [ ] Calendar reminder, before reminders are announced (c.9 asked for a
      real device): "Add a daily garden visit to my calendar" opens Google
      Calendar's new-event screen filled in with "Garden time 🦋", the chosen
      time and a daily repeat, and nothing from the journal; saved there, the
      event comes back each day and Google Calendar reminds at that time.
      Only where no calendar app on the phone takes a new event this way
      (Google Calendar disabled and no other calendar app, for one), the same
      button saves the reminder's .ics file through Android's save screen and
      says "Calendar file saved"; opening it from Files is offered to
      whatever calendar app the phone has, if any: note what that app does
      with it, without counting it a failure if it does not import the file
- [ ] Sighting photo: "Add a photo, if you like" in Log a sighting, once from
      the camera and once from the gallery; each shows in the field book and
      again after the app is reopened; a photo taken with location on carries
      no location in a backup's copy of it
- [ ] The year's postcard: "Make a postcard", then "Save image" opens
      Android's save screen (GardenFilesPlugin.saveBinaryDocument); the saved
      image appears in Files, or in Photos when saved to Pictures, and opens
- [ ] Numbers: on the support page, a "Call" button opens the dialler with
      the number and a "Text" button the messages app, neither calling nor
      sending by itself; a number in the comfort plan opens the dialler with
      it
- [ ] Links out: a nature-count link in the field book, and "Chat online" or
      "Find a helpline near you" on the support page, open in the phone's
      browser; coming back, the app is as it was
- [ ] Breathing: Breathe with a butterfly with "A soft tone at each turn" on:
      the tone sounds through the speaker and through headphones at each
      turn of the breath, in step with the count

## iPhone PWA checklist

The web version in Safari on an iPhone, added to the Home Screen. Playwright's
WebKit in CI is not Safari on a phone, so these need a real one:

- [ ] Home Screen guide: in Safari, the garden's card shows the three steps
      (Share, then Add to Home Screen, then Add); following them puts the
      garden on the Home Screen, and "Got it" puts the card away for good
- [ ] Offline relaunch: with the garden on the Home Screen, opened once, then
      closed, in airplane mode it opens from the Home Screen icon to the
      garden as it was; with Calm motion off and iOS's Reduce Motion off, the
      butterflies fly
- [ ] Share backup with many photos: in a garden with a field book full of
      photos, "Share backup…" opens the share sheet within the tap's time
      limit, or, where getting it ready took too long, downloads it and says
      so; the shared file restores
- [ ] Calendar reminder: for the morning preset (8:00), or another time
      with a file in `public/reminders/*.ics`, "Add a daily garden visit to
      my calendar" is a plain link to that file, and it opens Calendar's
      add-event sheet with "Garden time 🦋" at that time, every day; added,
      the event reminds at that time
- [ ] Passkey: with the garden lock on, Settings → "Add a passkey…",
      confirmed with Face ID or Touch ID; "Lock now", then unlock with the
      passkey; "Remove the passkey", and the passcode still opens the
      garden
- [ ] Photo sighting: "Add a photo, if you like", once from the camera and
      once from the photo library; each shows in the field book and after the
      garden is closed and opened again from the Home Screen

## Recording a run

Each run of either checklist, with what failed; each failure becomes its own
fix.

| Date | Device model | OS version | Build | Failures |
| --- | --- | --- | --- | --- |
