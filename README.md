# Elevator Log

A tiny installable web app (PWA) for logging where your building's two elevators
are whenever you walk up to them, plus a simple analysis page.

Everything is stored **only on your phone**, in the browser's IndexedDB. There is
no server, no account, no network requirement once it's installed.

## What's here

- `index.html` — the quick-log screen. A floor grid up top (tap to pick,
  auto-prefilled by alternating between 8 and -2 based on your last save), and
  two side-by-side panels below it — **Small** and **Large**, one per elevator,
  laid out like a real elevator button panel, each tinted to tell the two
  apart at a glance. Tap **Log** to save a timestamped entry. The chip in the
  header shows your name (tap it to change) — it's stamped on every entry.
- `analysis.html` — total counts, a frequency chart of where each elevator tends
  to sit (bars run top-to-bottom like the real floor indicator), a chart of the
  average distance to the nearer elevator by hour of day (a rough "best time to
  head down" signal), a raw log table with per-row delete, and JSON export/import.
  Once logs from more than one person are present, a "Show logs from" filter
  appears to scope everything to one person or everyone combined.
- `manifest.json` + `service-worker.js` — make it installable and usable offline.
- `js/db.js` — the IndexedDB wrapper (the whole "backend").

## Try it locally first

From this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a desktop browser to click around. (Install
and offline behavior only fully work once it's served over HTTPS — see below.)

## Put it on your phone

A PWA needs to be served over **HTTPS** for "Add to Home Screen" to install it
properly with offline support (installing straight from a local file works in a
limited way, but skips the service worker). The easiest free option, since you
don't have a hosting setup yet:

### Recommended: GitHub Pages

1. Create a GitHub repo (can be private) and push this folder to it.
2. In the repo settings, enable **Pages**, serving from the `main` branch, root folder.
3. GitHub gives you a URL like `https://<you>.github.io/<repo>/`.
4. Open that URL in Chrome on your phone → menu → **Add to Home screen** / **Install app**.

This costs nothing, needs no server maintenance, and updates automatically
whenever you push changes.

### Alternatives, if you'd rather not use GitHub

- **Cloudflare Pages** or **Netlify** — drag-and-drop this folder in their web UI,
  get a free `https://...` URL immediately, no git required.
- Both work the same way from your phone's perspective as GitHub Pages.

Once installed, updates to the hosted files are picked up automatically the next
time you open the app with a connection (the service worker refreshes its cache
in the background).

## Backing up your data

Use **Export JSON** on the Analysis page occasionally, especially before you
reinstall the app, switch phones, or clear your browser's site data — local
storage does not survive any of those on its own.

## Combining logs from two phones

Each phone asks for a name the first time it's opened (tap the chip in the
header to change it later) and stamps it on every entry. To see both people's
logs together:

1. On each phone, open Analysis → **Export JSON**.
2. Get both files onto one phone (AirDrop-equivalent, email to yourself,
   whatever's easiest).
3. On that phone, Analysis → **Import JSON** each file in turn — entries add up
   rather than replace, so importing both keeps everything.
4. Use the **Show logs from** filter that appears once two names are present
   to view just one person's logs or everyone's combined.

There's no live sync yet — this is a manual "export both, import into one" merge
whenever you want a combined view. See the Google Drive idea below for making
this automatic.

## Ideas for later (not built yet)

- **Google Drive sync.** The natural next step: use Google Sign-In (a free
  Google Cloud OAuth client) and the Drive API's `appDataFolder` scope to
  push/pull the same JSON export automatically, so a second device (or a
  reinstall) picks up your history. This is a well-trodden pattern but adds a
  chunk of setup (Cloud Console project, OAuth consent screen with yourself as
  a test user, a small sign-in flow in the app) — worth doing once you're using
  the app for real and want the safety net.
- Day-of-week patterns, not just hour-of-day.
- A "which elevator arrives at my floor first" streak/success-rate stat.
- A home-screen quick-action shortcut straight into the log screen (already
  close today since the installed app *is* the log screen).
