# Every Cent — Money Tracker

A beginner-friendly personal money tracker built as a static web app. It can be deployed directly from GitHub to Vercel with no build step.

## What it does

- Track money spent, received and moved between your own accounts.
- Track bank accounts, savings, cash, credit cards and loans.
- Mark spending as Essential, Worth it, Unsure or Waste.
- Show monthly income, spending, cash flow and potential waste.
- Track recurring bills and subscriptions.
- Subscription Rescue for payments you do not recognise.
- Annualise subscription costs so monthly costs are easier to judge.
- Show items that need attention.
- Export transactions to CSV.
- Download and restore a JSON backup.
- Works as an installable/offline-friendly web app after first load.

## Important privacy/data note

Version 1 stores data in `localStorage` in the browser on the device you use. It does not send your financial information to a server and it does not connect to your bank. Clearing browser/site data can erase local records, so use **Review → Download backup** regularly.

## Files

- `index.html` — app structure
- `styles.css` — responsive phone/desktop design
- `app.js` — all money tracker logic
- `manifest.webmanifest` — installable web-app metadata
- `service-worker.js` — offline caching
- `vercel.json` — Vercel headers/configuration

## Put it on GitHub

1. Create a new GitHub repository, for example `every-cent-money-tracker`.
2. Upload every file in this folder to the root of the repository.
3. Commit the files.

## Deploy it with Vercel

1. Sign in to Vercel.
2. Choose **Add New → Project**.
3. Import the GitHub repository you just created.
4. Vercel should detect it as a static site. No framework or build command is required.
5. Click **Deploy**.

If Vercel asks for settings, use:

- Framework Preset: **Other**
- Build Command: leave blank
- Output Directory: leave blank
- Install Command: leave blank

## Next production upgrade

The safest next major upgrade is optional secure multi-device sync using authenticated accounts and a database. Do not add direct bank credentials to this static version.
