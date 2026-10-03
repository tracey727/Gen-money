# ARCHIVED / REFERENCE ONLY — GENEVIEVE Personal Budget predecessor

This repository is an older personal-budget implementation retained for historical and feature-reference purposes.

**Current modern personal product:** https://github.com/tracey727/budget-calculator-personal

**Separate active local-first product:** https://github.com/tracey727/My-budget

Do not treat this repository as the production source and do not deploy it as a competing budget application. Its code and Git history remain intact so older local-first, sync and visual work can still be recovered if needed. The obsolete Vercel configuration has been removed; active GENEVIEVE builds use GitHub + Cloudflare + Neon where persistence is required.

---

# Genevieve App — Personal Budget App

This repository contains the personal money, budgeting, recurring-cost and waste-review application for the Genevieve App ecosystem.

## Brand asset

The application uses the archived `Roots of Every Journey.png` artwork supplied by Tracey as the source master. The web-optimised copy is stored at:

`assets/genevieve-roots-logo.webp`

The safety wording remains **“Safety from roots to every journey.”**

## Core personal-finance functions

- Accounts and balances
- Income and expense tracking
- Monthly category budgets
- Safe-to-spend calculation
- Bills and recurring subscriptions
- Savings goals
- Essential / Worth it / Unsure / Waste spending review
- Annual recurring-cost and waste estimates
- Genevieve Green / Yellow / Red warning system
- Backup and export

## Data

The browser can retain a private device copy. When the secure backend environment is configured, the same state is synchronised through the existing API to the dedicated Neon PostgreSQL database.
