# Acceptance status (honest)

**Nothing in this repository has been executed.** It was written in an environment with no network access, so `npm install`, type-checking, building, unit tests, and Playwright were never run, and the UI was never rendered or compared with the reference screenshot.

What *was* done: every file parses; a partial type-check (local code fully checked, third-party types stubbed) found no local errors; cross-file imports/exports were checked; and static review of the e2e flows found and fixed real bugs (e.g. a frozen date range that hid newly added transactions). Run `npm run check && npm run e2e` before relying on any of it.

Legend: ✅ implemented · 🟡 implemented, unverified · ⛔ not done / not possible yet

| # | Criterion | Status | Notes |
|---|---|---|---|
| 1 | Desktop dashboard matches the screenshot's composition | 🟡 | Built from measured proportions; never rendered or compared |
| 2 | Floating pill top nav | 🟡 | |
| 3 | Compact sidebar rail | 🟡 | "Messages"/"Help" replaced by Contacts/Notifications (no backend for them) |
| 4 | Heading + actions row | 🟡 | |
| 5 | Card positions and relative widths | 🟡 | |
| 6 | Emerald wallet card focal point | 🟡 | |
| 7 | Rounded bars, one highlighted | 🟡 | |
| 8 | Smooth line chart with mint fill | 🟡 | |
| 9 | Transactions table lower-left/center | 🟡 | |
| 10 | Lower-right summary card | 🟡 | Shows real pending payments instead of "credit" (Finova issues no credit) |
| 11 | Typography, spacing, shadows, radii, colours tuned | ⛔ | Needs a visual tuning pass against the screenshot in a browser |
| 12 | Navigation and primary interactions work | 🟡 | e2e written, not run |
| 13 | Wallet/transaction data persists in MongoDB | 🟡 | |
| 14 | Charts and balances reflect database records | 🟡 | |
| 15 | Authentication and resource authorization | 🟡 | Isolation tests in API suite and e2e |
| 16 | No essential workflow is fake | 🟡 | Removed: Messages, Help, theme switch, email-notification toggle (nothing sends those) |
| 17 | Responsive, no horizontal overflow | 🟡 | e2e overflow check written, not run |
| 18 | Type checks and production builds pass | ⛔ | Not run |
| 19 | Environment variables documented | ✅ | `.env.example` files, README, DEPLOYMENT.md |
| 20 | Tests cover critical workflows | 🟡 | API, web and e2e specs written; none executed |

## Known gaps and limits
- **Email:** password-reset/verification emails only send when SMTP is configured. Notification emails are not implemented. Email verification does not gate any action yet.
- **Documents:** S3 driver is written but untested; seeded documents are metadata only (no files behind them).
- **Rate limiting** is in-memory (per instance); use a shared store before scaling out.
- **Dark theme** intentionally not built (the brief forbids it); `theme` exists in the API only.
- **Concurrency:** ledger writes are serialised per wallet via MongoDB transactions; covered by one test that has never run.
- **a11y:** axe checks exist in e2e (WCAG A/AA, serious/critical); manual screen-reader testing has not been done.
- **Shared types:** the web app duplicates a few API types and money helpers; a `packages/shared` module would remove that.
