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
> • Seven illustrated scenes, a starry night mode, and three soundscapes made
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
(live once this branch is merged and Pages deploys). The same page is inside
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

**Data safety:**
- The app's own code collects nothing: "collect" means sending data off the
  device, and the journal, moods, goals, garden and images never leave it.
  https://support.google.com/googleplay/android-developer/answer/10787469
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
  lives only on the device; Settings → Delete all local data removes it.

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
