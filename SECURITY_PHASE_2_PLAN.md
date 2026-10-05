# Diagrid Security Hardening — Phase 2 Plan

Plan date: 2026-10-05
Status: In progress; PR 1 is implemented locally and awaiting CI/staging execution.
Prerequisite: Phase 1 must be deployed and verified in staging before Phase 2 changes reach production.

## Current implementation record

Implemented locally on 2026-10-05:

- Replaced the remaining sign-in audit-table insert with `log_user_activity`.
- Removed the unused sample audit writer that bypassed the RPC boundary.
- Added a reproducible baseline schema migration before the existing incremental migrations.
- Added Supabase local configuration with an eight-character local password minimum, secure password changes, one-hour JWTs, and correct Vite redirect URLs.
- Added 15 pgTAP assertions for RLS, grants, feedback restrictions, audit integrity, and diagram complexity limits.
- Added application, database-security, CodeQL, and dependency-review GitHub Actions.
- Added grouped weekly Dependabot configuration for npm and GitHub Actions.
- Added explicit typecheck and database-security package scripts.
- Repaired the offline-sync test harness after the project quota service dependency changed.

Verified locally:

- Lint passed with seven existing warnings.
- TypeScript passed.
- All 23 application unit tests passed.
- Production build passed.
- Production dependency audit passed with zero vulnerabilities.
- `git diff --check` passed.

Pending verification and external configuration:

- Run the pgTAP suite in GitHub Actions or locally after Docker Desktop is available. The local Docker app launch approval timed out during this implementation turn.
- Apply and verify the Phase 1 migration in staging.
- Confirm the baseline migration against the linked Supabase migration history before the first remote `db push`; use `supabase migration list` and repair history rather than guessing if the hosted schema was created manually.
- Enable branch protection, Dependabot security updates, secret scanning, and push protection in GitHub repository settings.
- Review the newly published `braces` advisory. It currently has no patched release and is present only through Tailwind 3 build tooling; production dependencies are unaffected. Plan a Tailwind 4 migration or adopt a patched upstream release when available.

## Objective

Phase 2 will add abuse prevention, stronger controls for privileged actions, correct account/session lifecycle handling, and continuous security verification. Security decisions will remain server-enforced through Postgres, Supabase Auth, Storage policies, and Edge Functions. React checks are user-experience controls only.

## Priority order

1. Close and verify the Phase 1 baseline.
2. Add database security tests and CI gates.
3. Move feedback and attachment submission behind an abuse-resistant Edge Function boundary.
4. Require MFA and recent authentication for administrative mutations.
5. Implement explicit archive and permanent-delete account workflows.
6. Improve upload verification, retention, local-data cleanup, and security monitoring.

This order is deliberate: tests and deployment verification should exist before changing privileged paths or introducing service-role functions.

## PR 1 — Phase 1 closure and automated security gates

### Work

- Apply `supabase/migrations/20260924000000_security_hardening_phase1.sql` to staging and execute the Phase 1 principal matrix: anonymous, user A, user B, suspended user, and administrator.
- Replace the remaining direct `audit_logs` insert in `src/services/authService.ts` with `log_user_activity`. Direct inserts are already revoked by Phase 1 and the current call will fail silently.
- Initialize the Supabase local-development configuration if it is not already available.
- Add pgTAP RLS tests under `supabase/tests/database/` covering:
  - anonymous diagram denial;
  - owner access and cross-user denial;
  - project ownership validation on diagram writes;
  - suspended-user denial;
  - administrator access;
  - audit-log insert denial;
  - feedback column restrictions;
  - diagram size/count constraints;
  - execute grants on sensitive RPCs.
- Add GitHub Actions for `npm ci`, lint, TypeScript, unit tests, production build, database tests, and CodeQL.
- Add dependency review for pull requests and weekly grouped Dependabot updates.
- Enable GitHub secret scanning and push protection in repository settings where the repository plan supports them.
- Require the CI status checks on the protected production branch.

### Expected files

- `src/services/authService.ts`
- `supabase/config.toml`
- `supabase/tests/database/security_rls.test.sql`
- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/dependency-review.yml`
- `.github/dependabot.yml`
- `SECURITY_HARDENING.md`

### Exit criteria

- Phase 1 migration passes on staging.
- pgTAP proves the five-principal permission matrix.
- Pull requests cannot merge when the app build, unit tests, RLS tests, or dependency review fail.
- No client code writes directly to `audit_logs`.

## PR 2 — Feedback abuse prevention and upload quotas

### Architecture

Replace direct browser inserts into `public.feedback` with a `submit-feedback` Supabase Edge Function. The function will be the only submission path and will:

1. Reject non-POST requests and unexpected origins.
2. Enforce a small request-body limit before parsing JSON.
3. Validate a strict input schema and normalize strings.
4. Validate a Cloudflare Turnstile token server-side.
5. Identify authenticated users from the bearer token; anonymous requests use a keyed, non-reversible IP fingerprint rather than storing a raw IP address.
6. Atomically enforce short- and long-window quotas in Postgres.
7. Insert only approved feedback columns through a server-side client.
8. Return generic errors without exposing database or provider details.

Recommended initial quotas:

| Actor | Short window | Daily window |
| --- | ---: | ---: |
| Anonymous | 3 submissions / 10 minutes | 10 / 24 hours |
| Authenticated | 10 submissions / 10 minutes | 40 / 24 hours |
| Attachment upload tickets | 2 / 10 minutes | 5 / 24 hours |

These values should be configuration constants and adjusted from observed traffic, not guessed repeatedly in code.

### Attachment flow

- Add a separate authenticated `feedback-upload-ticket` Edge Function.
- The function applies upload quotas and returns a short-lived signed upload token for a generated owner-prefixed path.
- Revoke normal authenticated `insert` access to the feedback bucket so clients cannot bypass quotas.
- When feedback is submitted, verify that the attachment path belongs to the authenticated user and has the expected prefix.
- Delete unused upload objects after 24 hours and resolved feedback attachments after the chosen retention period (recommended starting point: 90 days).

### Required secrets and configuration

- Browser: `VITE_TURNSTILE_SITE_KEY`.
- Edge Function secrets: `TURNSTILE_SECRET_KEY` and `RATE_LIMIT_HMAC_SECRET`.
- Never place either secret in a `VITE_` variable or commit it to Git.
- Update CSP for the exact Turnstile script/frame/connect origins required by the widget.
- Provide Cloudflare test keys for local and CI tests.

### Database changes

- Add an atomic rate-limit function/table with no client grants.
- Revoke `insert` on `public.feedback` from `anon` and `authenticated` after the Edge Function is deployed.
- Add indexes and expiry cleanup for rate-limit buckets.
- Keep administrator feedback read/update/delete policies unchanged.

### Expected files

- `supabase/functions/submit-feedback/index.ts`
- `supabase/functions/feedback-upload-ticket/index.ts`
- `supabase/functions/_shared/` validation, CORS, authentication, and response helpers
- `supabase/migrations/<timestamp>_feedback_gateway.sql`
- `src/components/ui/FeedbackModal.tsx`
- `src/services/adminService.ts` or a dedicated `feedbackService.ts`
- `vercel.json`
- Edge Function and application regression tests

### Exit criteria

- Direct REST inserts into `feedback` fail for browser roles.
- Invalid, missing, expired, and replayed Turnstile tokens fail.
- Concurrent requests cannot exceed the database-enforced quota.
- Raw IP addresses and Turnstile secrets are never persisted or returned.
- Direct feedback attachment uploads fail without a valid upload ticket.
- Normal feedback submission and administrator review still work.

## PR 3 — Administrator MFA and recent-auth enforcement

### Work

- Add TOTP enrollment, challenge, verification, recovery guidance, and factor management UI.
- Add an MFA challenge route for sessions whose current assurance level is `aal1` and next level is `aal2`.
- Require administrators to enroll MFA before accessing mutation controls.
- Add a shared `require_admin_aal2()` database helper that verifies:
  - `auth.uid()` belongs to an active administrator;
  - the JWT `aal` claim is `aal2`;
  - the JWT issuance time is recent for destructive operations.
- Apply this helper inside role, status, supporter, system-setting, and account-deletion operations. Do not rely only on hiding buttons in the UI.
- Use a ten-minute recent-auth window for role changes and permanent deletion. If the session is older, send the administrator through a fresh MFA challenge.
- Record authoritative audit events inside the same database transaction as each RPC mutation.
- Remove duplicate client-authored audit events for those actions.

### Session behavior

- A suspended account is denied immediately by RLS through `is_active_user()` even while an issued access token has not expired.
- Set the Supabase JWT lifetime to a reasonable bounded value; do not reduce it below five minutes.
- Use explicit sign-out scope in the client so normal user sign-out behavior is intentional rather than dependent on SDK defaults.
- Treat permanent Auth deletion separately from temporary suspension because deleting the Auth user removes refresh sessions while suspension preserves the account.

### Expected files

- MFA components and routes under `src/pages/` and `src/components/`
- `src/services/authService.ts`
- `src/services/adminService.ts`
- `supabase/migrations/<timestamp>_admin_mfa.sql`
- RLS/RPC and browser-flow tests

### Exit criteria

- An administrator at `aal1` cannot execute any privileged mutation through direct RPC calls.
- A verified `aal2` administrator can perform allowed operations.
- A stale `aal2` session is challenged again before destructive operations.
- Self-demotion, self-suspension, and last-admin protections still pass.
- Every privileged mutation has one authoritative audit record with actor, target, action, outcome, and timestamp.

## PR 4 — Account lifecycle, verified images, and privacy cleanup

### Account lifecycle

- Rename the current `deleteUser` behavior to `archiveUser`; it currently suspends the account and preserves data.
- Add an AAL2-protected `delete-user` Edge Function for actual deletion because `auth.admin.deleteUser()` requires a server-side secret key.
- Require a typed confirmation and recent MFA before permanent deletion.
- Define and test deletion order for feedback attachments, avatars, diagrams/projects, audit references, profile data, and the Auth user.
- Keep audit records pseudonymous where operationally required; do not retain email unnecessarily after deletion.
- Add a user-facing self-service account deletion flow only after the administrator flow is stable.

### Image handling and retention

- Perform a short technical spike to select a maintained server-side decoder for JPEG, PNG, and WebP in the Edge runtime.
- Decode and re-encode accepted uploads to verify signatures, remove metadata, and prevent polyglot files. Reject content that cannot be decoded even when its MIME header looks valid.
- Delete the previous avatar after a successful replacement.
- Add scheduled cleanup for orphaned feedback uploads and expired attachments.

### Browser data

- Inventory every `localStorage` and `sessionStorage` key.
- On sign-out, clear identity/session-derived data and user-specific offline queues without wiping unrelated preferences unnecessarily.
- Namespace offline data by user ID and prevent one user from seeing another user's queued content on a shared browser.
- Clear all user-owned browser data after permanent account deletion.

### Monitoring

- Deploy CSP reporting in report-only mode first, with sampling and rate limiting.
- Alert on repeated feedback rejection, repeated privileged-operation denial, and unexpected direct API attempts.
- Define an audit retention policy and a documented incident-response contact/process.

### Exit criteria

- Archive and permanent deletion are distinct in UI, code, and documentation.
- Permanent deletion removes the Auth account and prevents refresh-token reuse.
- Renamed or polyglot image payloads are rejected.
- Re-encoded images contain no original metadata.
- User-specific local data does not survive sign-out or permanent deletion.
- Cleanup jobs are observable and safe to rerun.

## Test matrix

Every PR must cover the relevant paths for these principals:

| Principal | Expected security posture |
| --- | --- |
| Anonymous | Public routes only; feedback requires valid Turnstile and strict quota |
| Active user A | Own projects, diagrams, uploads, and profile only |
| Active user B | Cannot access user A resources even with known IDs |
| Suspended user | No project, diagram, or upload access; cannot refresh into useful access |
| Administrator at AAL1 | Read-only administration; privileged mutations denied |
| Administrator at AAL2 | Allowed privileged operations, subject to recent-auth checks |
| Service-role Edge Function | Only narrowly defined server operations; never exposed to browser code |

Tests must include happy paths, cross-user attempts, malformed payloads, oversized payloads, replay, concurrency at quota boundaries, expired tokens, direct REST bypass attempts, and rollback/error behavior.

## Rollout sequence

For each PR:

1. Run local unit, build, Edge Function, and pgTAP tests.
2. Deploy additive database/function changes to staging.
3. Deploy the staging frontend.
4. Run the principal matrix and direct-API bypass tests.
5. Observe logs and error rates for at least one normal test cycle.
6. Apply permission revocations only after the replacement path is confirmed.
7. Deploy production during a monitored window.
8. Retain a migration-level rollback plan that restores availability without reopening broad public access.

## Recommended implementation schedule

| Work package | Estimated focused effort |
| --- | ---: |
| PR 1: baseline closure and CI | 1–2 days |
| PR 2: feedback gateway and quotas | 2–4 days |
| PR 3: MFA and recent-auth controls | 3–5 days |
| PR 4: deletion, image verification, privacy cleanup | 3–5 days plus decoder spike |

Estimates assume access to the Supabase staging project, Cloudflare Turnstile keys, GitHub repository settings, and a local Docker-compatible runtime. External approvals and production observation time are not included.

## Required external setup

Before PR 2:

- Create separate Turnstile widgets/keys for staging and production.
- Add Edge Function secrets through Supabase project secrets.

Before PR 3:

- Enable TOTP MFA in Supabase Auth settings.
- Confirm desired JWT expiry and session policy.

Before enforcing CI:

- Enable GitHub Actions, dependency graph, Dependabot alerts/security updates, CodeQL availability, secret scanning, push protection, and branch protection as supported by the repository plan.

## Definition of Phase 2 complete

Phase 2 is complete only when:

- Phase 1 and Phase 2 migrations are deployed and tested in production.
- Feedback and feedback attachments cannot bypass server verification or quotas.
- Administrative mutations require server-verified AAL2 and recent authentication.
- Archive and permanent deletion have correct, tested semantics.
- RLS/RPC tests and application security checks run on every pull request.
- Dependency and secret protections are active in GitHub.
- The security record documents deployment dates, configuration decisions, test evidence, and known residual risks.

## Primary references

- [Supabase database testing and pgTAP](https://supabase.com/docs/guides/local-development/testing/overview)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase MFA and AAL enforcement](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase user sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase user deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
- [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [GitHub dependency review](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review-action)
- [GitHub Dependabot security updates](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates)
- [GitHub push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)
