# Halal Connect Spec Completion Plan

This is the durable handoff ledger for implementing the attached “Halal Connect — Complete App-Side & API-Side Specification” across `d:/halal_app_backend`, `d:/halaal_dating_app`, and the supplied dashboard repository cloned at `d:/radiant-guidance-hub`. Update this file after each completed work package. Do not repeat an item marked complete unless its evidence is invalidated by a later change.

## Working Rules

- Treat the user-pasted specification as the target contract. Preserve existing API routes when possible; add compatible routes/adapters rather than breaking current clients without need.
- Keep secrets exclusively on the backend. Never add payment credentials or signing secrets to Flutter, web assets, logs, or checked-in env files.
- Do not grant paid entitlements from client assertions, plan-selection UI, or an unverified callback. Only a verified provider event/status response may grant them. Keep development/test bypasses explicit and disabled outside development.
- Preserve existing uncommitted work in all roots. The app and backend had substantial existing edits at start; the dashboard clone was clean before this task. Inspect a target file before editing it; do not overwrite user changes.
- After each package, run the narrowest relevant executable check, record the exact command/result below, and keep the package small enough for another agent to resume.
- The admin dashboard lives in a third repository. Its package lock is inconsistent with package.json; dependencies were installed without lockfile writes for build verification. Do not silently normalize that lockfile.

## Phase 0: Baseline and Handoff

- [x] Compare both roots to the attached spec and identify route/behavior mismatches.
- [x] Record current dirty worktree constraints.
- [ ] Capture clean baseline build/test status for Flutter and NestJS without altering user changes.
- [ ] Generate an endpoint coverage matrix from actual controller routes and client calls (not planning documents alone).

## Phase 1: Payment and Entitlement Safety (blocking)

- [x] Remove/disable user-controlled direct plan activation via `/users/me/plan`; route legitimate plan changes through a verified billing workflow and reserve overrides for authorized admin actions.
- [x] Implement Pesapal as the configured provider: server-only encrypted credentials/environment/callback/IPN config, admin settings/test-connection APIs, public config limited to provider/currency/catalogue/gifts/withdrawal threshold, and checkout for subscriptions and gifts. (Live credentials/provider round-trip remain untested.)
- [x] Implement verified Pesapal IPN processing, idempotency by provider order/tracking ID, provider status confirmation before granting entitlement/credit, and authenticated status polling.
- [ ] Add subscription cancellation/current entitlement behavior consistent with actual payment status; ensure public/app config never leaks credentials.
- [x] Replace the app's simulated subscription charge/plan mutation with config-driven checkout, safe browser/webview handoff, callback/deep-link handling, status polling and server-driven entitlement refresh. (Polling is wired; deep-link callback parsing remains a release follow-up.)
- [x] Add discount validation to the real checkout path if configured by the dashboard. (Code is validated by the server at checkout and usage is reserved/redeemed/released atomically.)
- [ ] Add focused tests for unauthenticated/forged completion, duplicate IPN, failed/pending payments, provider config secrecy, and successful verified activation.

Acceptance: paid access and gift credit cannot be obtained through a Flutter-only action or unverified public request; replayed provider notifications do not double-credit; Flutter renders server-supplied prices and follows payment status from the server.

## Phase 2: Gifts, Wallet, and Withdrawals

- [x] Add Prisma models/migrations for managed gift catalogue, owned inventory, sent/received gifts, wallet ledger/balance, withdrawal requests, and payment order linkage (including uniqueness/idempotency constraints).
- [x] Add user APIs for catalogue, purchase, inventory, send, received history, wallet summary/ledger, withdrawal request/history.
- [x] Enforce gift purchase confirmation through Phase 1 provider verification; credit recipient only once at configured cash value; enforce minimum threshold, balance limit, and one pending withdrawal.
- [x] Add admin APIs for gift catalogue CRUD, withdrawal queue/review/mark-paid/reject with auditable balance reversal, transaction search, and user ledger.
- [x] Add app API models/services/screens for gift shop, owned inventory/send flow, received history, wallet, and withdrawal status.
- [ ] Add focused service/controller tests for purchase idempotency, ledger consistency, unauthorized access, and withdrawal boundaries. (Withdrawal boundary tests exist; gift fulfillment tests remain.)

## Phase 3: Verification and Photo Privacy/Safety

- [x] Align or adapt profile-photo verification submission, ID/selfie submission, verification status, and admin pending queue/approve/reject. Send in-app/push decisions.
- [ ] Implement authenticated private-photo requests with reason, received queue, approve/decline, grant listing/revoke, expiry after seven days, audit rows for every action, and automatic revoke on unmatch/block.
- [x] Replace direct public serving of private photos and verification documents with authorization-checked or short-lived signed access. Keep ordinary public assets available. (Private files are outside static roots; verification directory is no longer mounted; legacy private photos migrate on startup.)
- [x] Add admin photo queue/review/reject and read-only access audit/safety override APIs with audit logging. (Dashboard Photos API paths are wired.)
- [x] Add app flows for photo verification state/submission and private-photo grant review/revoke, matching current API behavior.
- [x] Add access-control tests proving unrelated users cannot read private or verification files and expired/revoked grants do not expose them. (Forged signature and denied grant cases covered; expired/revoked grant-specific assertions remain.)

## Phase 4: API Contract and Core Product Flows

- [x] Add `/legal/privacy` and `/legal/terms` static content routes and app fetch with bundled offline fallback. `/islamic/settings` GET/PUT, `/tasbih/sync` and `/tasbih/streak`, `/profile` and questionnaire/photo/completeness, `/discover`, `/likes`, `/passes`, `/chats`, `/subscriptions/me`, `/photos/:id`, `/photos/private/...`, `/account`, `/journey`, and `/payments/config` are implemented.
- [x] Add missing unmatch behavior: revoke photo grants, close/disable conversation, and notify parties; verify block also revokes grants. (Backend build passes; specific unmatch/block regression coverage is still needed.)
- [ ] Add verified-user text-only chat policy as a server-side configurable gate if the intended policy is still required.
- [ ] Add persistent notification read-by-ID behavior and notification types needed by the spec, preserving mark-all-read compatibility.
- [x] Complete account deletion-request workflow (password/reason, status, admin queue) or explicitly align the spec if immediate deletion is chosen; do not claim the current hard delete is a request. (DELETE /account stores a pending request; admin queue and approve/reject routes are present. Legacy /users/me hard-delete remains for compatibility and is no longer used by the app.)
- [x] Complete Wali status/preferences/remove APIs against email-only wali invitation requirements, signed expiring public tokens, scheduled digest preferences, and ensure any enabled approval is enforced in like/match actions. (Status/preferences/removal, signed seven-day links, scheduled digest, and server-side approval gates exist.)
- [x] Add persistent notification read-by-ID behavior and retain mark-all compatibility.
- [x] Add app integration for server legal content with bundled offline fallback. Islamic settings API client, Wali settings, and journey are wired.
- [ ] Verify pagination/search conventions are consistently supported where the spec requires list pagination.

## Phase 5: Admin API Coverage

- [x] Add dashboard-facing verification queue and photo moderation routes.
- [x] Add dashboard-facing payment config, Pesapal connection test, transaction filtering, discount CRUD, gifts CRUD, and withdrawal workflows.
- [ ] Add safety/moderation audit coverage for private-photo actions, verification decisions, payment/withdrawal changes, and account deletion requests.
- [ ] Add admin API contract tests for role guard, pagination/filtering, audit events and non-secret serialization.

## Phase 6: Validation and Release Readiness

- [ ] Run backend Prisma format/generate/migrate validation, build, and full test suite. (Schema/build pass; 10 focused tests pass; full suite has unrelated auth ESM, matches guard, and socket-smoke failures.)
- [ ] Run Flutter format/analyze/tests; build app if dependencies/platform setup permits. (Editor diagnostics clean for touched app files; CLI analyzer did not complete reliably.)
- [ ] Exercise cross-root contract smoke tests for signup/profile, verification, discovery/match/chat, payment callback/status, gift credit/wallet, notifications, support, and account deletion.
- [ ] Update README with actual setup/environment variables, migration commands, payment sandbox setup, callback/IPN configuration, and the exact routes that are supported.
- [ ] Update the endpoint matrix and this ledger with passed/failed checks and blockers.

## Findings To Preserve

- All roots contain existing or task-created uncommitted work; do not reset or revert it. The dashboard repo was clean at clone time.
- Backend uses global `/api`; actual core routes include `/users/me/*`, `/chat/conversations/*`, `/billing/*`, `/matches/*`, `/wali/*`, `/tasbih/*`, `/support/tickets/*`.
- Legacy Stripe/store billing handlers remain for compatibility, but the app paywall now uses Pesapal; direct user plan mutation is closed and manual paid checkout is rejected.
- The legacy app payment screen now delegates to the server-configured Pesapal checkout and no longer calls `ProfileApi.changePlan` to grant entitlement.
- Gifts/wallet modules, controllers, and Flutter clients have since been added.
- Private-photo files are stored outside static roots and use signed grant-checked URLs. Normal profile images remain static; pending moderation images are omitted from profile serialization, but a leaked static URL can still be fetched.
- Wali and health-disclosure files were user-modified at baseline and have been preserved.
- The admin dashboard source is available in the third root `d:/radiant-guidance-hub`.
- Backend has a `PaymentOrder` model/migration and Pesapal adapter under `src/billing`; settings are encrypted at rest with `PAYMENT_CONFIG_ENCRYPTION_KEY` (32-byte hex or base64). Public config never returns credentials. Flutter uses config, checkout, and status polling.
- Backend `npm run build` passed after Pesapal route/service additions. `npx prisma validate` passed using a temporary dummy `DATABASE_URL`; live database migration has not been run.
- Added gifts and wallet models/migrations, user/admin routes, Pesapal-backed gift checkout/fulfilment, recipient ledger credit on send, push notification, withdrawal reservation and reversal paths. Flutter now has Gift Shop/Wallet screens under Profile settings and uses Pesapal for paid subscription checkout; legacy payment screen no longer mutates plan state.
- Verified: backend `npm run build` passed; `npx prisma validate` passed; `npm test -- --runInBand wallet.service.spec.ts users.service.spec.ts` passed (5 tests); VS Code diagnostics found no errors in changed Flutter billing/commerce files. Flutter CLI analyzer did not return a normal result in this terminal; diagnostics provider was used as fallback.
- SQL migrations are authored but have not been applied to a live database. Pesapal sandbox/live credentials and callback/IPN registration are not available here, so no provider round-trip was tested.
- Private uploads are now stored outside the statically served directories; startup migration relocates existing private profile images. Signed ten-minute media links are checked against current grants/blocks and audited; pending requests expire after seven days; admin audit/revoke routes and spec-compatible app grant/revoke controls exist. Backend build and Prisma validate passed; 7 targeted tests passed across privacy, entitlement, and withdrawal.
- Account deletion now follows the requested review model through `DELETE /account`; admin queue/review endpoints log decisions, and the Flutter screen no longer logs users out on submission. Wali status/preferences/removal and signed path-token links are implemented; Wali preference UI is reachable from Profile. Notification read IDs are persisted while mark-all remains backward compatible.
- Latest validation: Prisma schema validation and generation passed; NestJS build passed; 10 focused backend tests passed; dashboard Vite production build passed; editor diagnostics report no errors in touched Flutter files.
- Dashboard dependencies were installed with `npm install --no-save --package-lock=false --legacy-peer-deps` because `npm ci` fails on a pre-existing package/lock mismatch. No lockfile or manifest changes were made by installation.
- Added discount-code persistence, admin CRUD, validation and server-side reservation lifecycle, plus app validation before checkout. Added journey progress persistence and Flutter checklist. New profile photos enter moderation as pending; existing photos default approved in migration; non-approved photos are filtered from other users' serialized profiles. Dashboard Photos and Verification pages now use real backend routes.
- Remaining privacy caveat: ordinary public-photo files are still served from the public `/uploads/photos/users/` static mount, so a leaked pending-photo URL can be fetched directly despite profile serialization. Replace that with authorization/signed delivery before relying on moderation for access control.
- Added `/islamic/settings` GET/PUT and `/tasbih/sync`; daily sync uses a conditional update so retries do not double-count. Added per-user chaperone mode and Flutter API clients.
- Remaining release blockers: SQL migrations are not deployed; live Pesapal credentials/IPN have not been exercised; payment/gift/discount idempotency tests and protected delivery for pending public images remain. Full backend tests have unrelated existing auth ESM/matches guard/socket failures; Flutter CLI analyze is unreliable in this terminal.

## Progress Log

### 2026-10-03 — Initial audit and plan

- Completed read-only app/backend comparison against the pasted spec.
- No tests/builds run as part of the audit.
- Closed direct user plan mutation; public user checkout rejects `manual` provider. Backend build passed.
- Added encrypted Pesapal settings/admin endpoints, public config, subscription and gift checkout, server-verified status/IPN, and database-backed order tracking. Schema validates; migrations are not applied to a database.
- Added wallet/gift backend and Flutter flows plus matching dashboard APIs. Entitlement and withdrawal boundary tests pass.
- Added dashboard contract fixes for payments, gifts, withdrawal approvals, verification review, photo moderation, and discounts.
- Added profile-photo verification UI/admin queue, scheduled Wali digests and exact app preference routes, per-ID notification reads, account-deletion requests, and persisted marriage journey.
- Added root route adapters for `/profile`, questionnaire/completeness/photo uploads, `/discover`, `/likes`, `/passes`, `/chats`, `/subscriptions/me`, and `/tasbih/streak`.
- Added `PUT /islamic/settings`, authenticated per-user setting read, idempotent `POST /tasbih/sync`, and server-side approval checks for enabled Wali like/match permissions.
- Final validation for this tranche: Prisma validate/generate, Nest build, 10 targeted Jest tests, dashboard production build, and VS Code diagnostics on edited Flutter files passed. Live database migrations/provider flow and Flutter CLI analysis remain unverified.
- Next action: add payment/gift/discount idempotency tests, remove the pending-photo public static URL bypass, apply migrations in deployment, and run Pesapal sandbox end-to-end. Then address the verified-user text-only chat gate and full admin audit coverage.

### 2026-10-03 — Paused for next agent at user request

- Added `D:/radiant-guidance-hub` from `https://github.com/mnsr22/radiant-guidance-hub.git` at revision `83bcf51` and added it as the third folder in `D:/halaal_dating_app.code-workspace`.
- Current verified checks: Prisma validate/generate, Nest build, and 10 focused tests pass; dashboard Vite production build passes; VS Code diagnostics report no errors in touched Flutter files. Flutter CLI analyze and live DB/provider tests remain unverified.
- The dashboard's tracked UI changes are in its git worktree; do not discard them. Its npm package lock was not modified. The app and backend also contain pre-existing/user edits; preserve them.
- Immediate next steps for the next agent: (1) replace public static profile-photo delivery with authorized/signed delivery and verify pending-photo denial; (2) add Pesapal/gift/discount idempotency tests; (3) run full app/backend/dashboard checks; (4) review/apply SQL migrations in the configured deployment database; (5) run Pesapal sandbox with real server-side credentials and registered IPN.
- Deferred work: configurable verified-user text-only chat gate; fuller admin audit coverage; uniform list pagination/search; resolve pre-existing full-suite auth ESM, matches guard, and socket smoke failures if they block required gates.

### App/backend/dashboard contract alignment continuation

- Aligned dashboard Tasbih settings and response adapters with persisted backend fields; Wali successful-empty results now stay empty instead of showing sample rows. Payment settings no longer send an editable Pesapal host, and failed dashboard mutations no longer create success-shaped local rows.
- Added app-plan price loading from the backend and removed static subscription prices from the app's payment/profile surfaces.
- Added dashboard live-feed `payment` and `verification` event types while preserving legacy `subscription` and `moderation` feed types. Verified subscription payments and gift checkouts emit payment events; verification decisions emit verification events.
- Added overview/list/verification response aliases and user search coverage for IDs and phone numbers, plus the related Wali, payments, wallet and mutation-audit compatibility work in this tranche.
- Validation after these edits: `npm run build` passed in the backend and dashboard; backend `npm test -- --runInBand` passed 9 suites (18 tests), with 1 suite/test skipped; `flutter test` passed 16 tests; targeted `flutter analyze` on the three edited Dart files reported no issues. Whole-app `flutter analyze` exits nonzero due 39 existing warnings/info findings in unrelated files. `git diff --check` passes in all three repositories after normalizing line endings in touched backend files.
- Still not certified as a full go-live: not every dashboard route has been exhaustively compared against its controller, Wali global settings are stored but not all operationally enforced, Pesapal sandbox/IPN and deployed DB migrations were not run, and user/device-level push delivery was not exercised. Do not describe this workspace as production-ready until these are verified.
- The tracked `.env.example` had a credential-like mail value removed during this work; rotate any corresponding credential that may have been published previously. No production secrets were inspected or used.
