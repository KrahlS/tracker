# Setting up Forge

Forge is a static site. It works on its own right away, saving to the device you're using.
Follow the steps below once to put it online and sync your phone and desktop.

## 1. Turn on GitHub Pages

1. Open the repo on GitHub, then go to **Settings → Pages**.
2. Under **Build and deployment**, set Source to **Deploy from a branch**, then pick branch **main** and folder **/ (root)**. Click **Save**.
3. After about a minute the site is live at **https://krahls.github.io/tracker/**.

## 2. Create the Firebase project (sync + sign-in)

1. Go to <https://console.firebase.google.com>, click **Create a project**, and name it `forge`. You can turn Google Analytics off.
2. **Sign-in:** go to **Build → Authentication → Get started → Sign-in method**.
   - Enable **Google** only. Pick your email as the support email, then Save. Leave Email/Password off so nobody can create throwaway accounts.
3. **Allow the site:** go to **Authentication → Settings → Authorized domains → Add domain** and enter `krahls.github.io`.
4. **Database:** go to **Build → Firestore Database → Create database**. Choose **production mode** and the location closest to you.
   Then open the **Rules** tab, replace everything with the contents of `firestore.rules` in this repo, and click **Publish**.
5. **Get the config:** click the gear icon, then **Project settings → General → Your apps**, then click the **</>** (Web) icon.
   Register an app called `forge`. Skip Firebase Hosting.
   Copy the `firebaseConfig` values (`apiKey`, `authDomain`, `projectId`, `appId`) into `config.js`, or just paste them to Claude.
   These values aren't secret. The rules from step 4 are what keep your data private.

## 3. Turn on Google Calendar (for Plan my week)

1. Open <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com> and pick the `forge` project in the top bar. Click **Enable**.
2. Open <https://console.cloud.google.com/auth/audience> (same project). Leave the app in **Testing**, then under **Test users** click **Add users** and add your own Gmail address.
3. When you first click **Read my calendar**, Google will warn that the app isn't verified. That's expected for a personal app. Click **Continue**.
   Forge asks to see your list of calendars, read your events (so it can plan around them and show them by name on Today), see free/busy for calendars shared with you, and manage only the calendars it creates. Nothing is written to your own calendars. It writes its blocks to a separate calendar called **Forge**.

## 4. Lock the database to your account

After you sign in once, copy your User UID from **Authentication → Users**, put it in place of the rule in `firestore.rules` (`request.auth.uid == 'YOUR_UID'`), and publish it again. Then nobody else can read or write, even with the config. Stay on the free **Spark** plan: it can't bill you; it only pauses when it hits the daily limits.

## 5. Use it

- Open the site on your phone, then **Share → Add to Home Screen**. It opens full screen like an app, and works with no signal at the gym.
- On each device, go to **Setup → Sign in with Google**. Everything you log syncs live between devices.
- **Setup → Export JSON** saves a backup file whenever you want one.

## 6. UWorld misses and Anki (Mac)

1. In Anki on your Mac, go to **Tools → Add-ons → Get Add-ons** and enter `2055492159` (AnkiConnect). Restart Anki.
2. Make sure Anki is signed in to AnkiWeb (**Sync** works), so changes reach Anki on your iPhone.
3. Get an API key at <https://console.anthropic.com/settings/keys>. In Forge, open **MCAT → UWorld misses → Setup on this device** and paste it. It stays in that browser only and is never synced. Each drafted card costs a few cents.
4. With Anki open, click **Connect Anki** in Chrome. Anki shows a popup asking to allow `https://krahls.github.io`. Click **Yes** (Chrome may also ask to allow local network access).

Log missed question IDs anywhere (Today's UWorld task or the MCAT tab). Back on the Mac, **Reset in Anki** sends every card tagged `#AK_MCAT_v2::#UWorld::<id>` back to new, at the front of the new queue. IDs with no card show **needs a card**: paste UWorld's explanation, draft, edit if needed, and add. New cards use the AnKing note type, go in the **UWorld Misses** deck, and are tagged with the same UWorld tag, so a repeat miss resets them too. Forge asks Anki to sync after each run.
