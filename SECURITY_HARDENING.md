# Diagrid Security Hardening Record

Last updated: 2026-10-05
Implementation status: Phase 1 implemented locally; database migration still requires deployment to Supabase.

## Purpose

This document records the security review, changes made, deployment requirements, verification performed, and remaining work. It is intended to remain the project-level security change log for this hardening effort.

## Initial findings

The review identified the following material risks:

1. `public.diagrams` had a `select using (true)` policy, allowing anonymous clients to query every stored diagram.
2. The feedback attachment bucket was public and allowed unauthenticated uploads without server-enforced size, type, or ownership restrictions.
3. Generated SVG was inserted into the application DOM with `dangerouslySetInnerHTML`. Some SVG attributes, including freehand paths and IDs, originated from diagram data.
4. URL share payloads and stored diagram JSON had no structural, complexity, or size limits.
5. Anonymous and authenticated clients could insert arbitrary rows into `audit_logs`, including forged identities and actions.
6. Admin role and status operations fell back from protected RPCs to direct table updates.
7. Suspended accounts were not excluded by project and diagram authorization policies.
8. Avatar upload accepted SVG and GIF content and derived the stored extension from the client filename.
9. Deployment headers did not include CSP, HSTS, or a restrictive Permissions Policy.
10. `npm audit` initially reported eight vulnerabilities: five high and three moderate.

## Changes implemented

### 1. Private diagrams and ownership integrity

Files:

- `supabase/migrations/20260924000000_security_hardening_phase1.sql`
- `supabase/schema.sql`

Changes:

- Removed anonymous `select` access to the complete diagrams table.
- Diagram reads now require an authenticated owner or administrator.
- Diagram inserts require both `user_id = auth.uid()` and a project owned by that user.
- Diagram updates cannot move a user-owned diagram into another user's project.
- Diagram updates and deletes require an active account.
- Existing self-contained links containing `#d=` continue to work because URL fragments are decoded locally and are not fetched from `public.diagrams`.
- ID-only public database links will intentionally stop working after migration deployment.

### 2. Suspended-account enforcement

Files:

- `supabase/migrations/20260924000000_security_hardening_phase1.sql`
- `supabase/schema.sql`

Changes:

- Added `public.is_active_user()` as a security-definer authorization helper.
- Project and diagram read/write policies now require an active user, while administrators remain operational.
- User-owned storage writes also require an active account.
- Status RPC input is restricted to `active` or `suspended`.
- Administrators cannot suspend themselves or another administrator.

### 3. Admin operations fail closed

Files:

- `src/services/adminService.ts`
- `supabase/migrations/20260924000000_security_hardening_phase1.sql`
- `supabase/schema.sql`

Changes:

- Removed direct-table fallbacks from role and status updates.
- Failed RPC authorization now produces an error instead of attempting another mutation path.
- Role values are validated by the database.
- Administrators cannot demote themselves.
- The final administrator cannot be demoted.
- Security-definer admin RPC execution is revoked from `public` and `anon`, then granted to `authenticated`; each RPC retains its internal `is_admin()` check.
- Role and status RPCs record the acting administrator inside the database transaction in the migration version.

### 4. Audit-log integrity

Files:

- `src/services/adminService.ts`
- `supabase/migrations/20260924000000_security_hardening_phase1.sql`
- `supabase/schema.sql`

Changes:

- Revoked direct audit-log insertion from anonymous and authenticated clients.
- Added `log_user_activity(action, target)` RPC.
- Actor ID and email are derived from `auth.uid()` and the profile table instead of client parameters.
- Action format and target length are bounded.
- Client activity logging now uses the RPC.

The target text remains user-supplied telemetry. It must not be treated as a trusted authorization record. Sensitive admin RPCs should continue to write authoritative audit records inside their own database transaction.

### 5. Private and constrained uploads

Files:

- `src/services/adminService.ts`
- `src/services/storageService.ts`
- `supabase/migrations/20260924000000_security_hardening_phase1.sql`
- `supabase/schema.sql`

Changes:

- Changed `feedback-attachments` to a private bucket.
- Feedback screenshots require authentication and an owner-prefixed object path.
- Administrators receive one-hour signed URLs when reviewing attachments.
- Screenshot uploads are limited to PNG, JPEG, and WebP with a 5 MB bucket/client limit.
- Avatar uploads are limited to PNG, JPEG, and WebP with a 2 MB bucket/client limit.
- SVG and GIF avatars are no longer accepted.
- Stored filenames use `crypto.randomUUID()` and a server-approved extension derived from MIME type.
- Uploads no longer use `upsert`.
- Guest users may still submit text feedback, but must sign in to attach a screenshot.

Client MIME checks improve UX but are not a substitute for file-signature inspection. Server-side image decoding/re-encoding remains future work.

### 6. Feedback write restrictions

Files:

- `src/services/adminService.ts`
- `supabase/migrations/20260924000000_security_hardening_phase1.sql`
- `supabase/schema.sql`

Changes:

- Revoked broad table insertion and granted only the columns clients need.
- Clients can no longer submit `admin_notes`, `status`, or timestamps.
- RLS bounds email, type, rating, message length, page URL length, and priority values.
- Authenticated submissions cannot claim another user's ID.

Anonymous feedback still requires rate limiting or bot protection before it should be considered abuse-resistant.

### 7. Diagram payload validation

Files:

- `src/utils/diagramSecurity.ts`
- `src/utils/shareUtils.ts`
- `src/services/diagramService.ts`
- `src/pages/Editor.tsx`
- `src/pages/PublicViewer.tsx`
- `src/pages/EmbedWidget.tsx`

Changes:

- Added one shared validation boundary for diagram JSON.
- Applied it to share-link decoding, editor loading, public/embed loading, diagram creation, and diagram saves.
- Added limits of 2 MB content, 500 shapes, 2,000 connections, and 500 freehand drawings.
- Added matching coarse database constraints for content size and collection counts, protecting direct PostgREST writes that bypass the client. The constraint is `NOT VALID`, so it applies to new and changed rows without blocking deployment on legacy content.
- Rejects excessive nesting, oversized strings, non-finite/extreme numbers, forbidden prototype keys, malformed IDs, duplicate node IDs, dangling edge references, and unsafe/oversized freehand SVG paths.
- Share payloads are capped at 256 KiB before Base64 decoding.
- Share metadata is restricted to known diagram types and bounded titles/IDs.
- Invalid content is rejected instead of silently persisted.

These are security limits, not intended product capacity guarantees. They can be adjusted deliberately after performance testing.

### 8. SVG/XSS hardening

Files:

- `src/utils/diagramExport.ts`
- `src/components/canvas/ExportModal.tsx`
- `package.json`
- `package-lock.json`

Changes:

- Added patched DOMPurify as a direct dependency.
- Sanitizes every generated standalone SVG using the SVG profile.
- Explicitly forbids scripts, `foreignObject`, frames, objects, embeds, images, links, `use`, and style elements.
- Disabled unknown URL protocols.
- Removed `dangerouslySetInnerHTML` from export preview.
- Export preview now renders the sanitized SVG through an isolated image data URL.

Downloaded SVG files are generated from the sanitized markup as well.

### 9. Deployment headers

File: `vercel.json`

Added:

- Content Security Policy
- HSTS with subdomains
- Permissions Policy disabling camera, microphone, geolocation, payment, and USB
- Cross-Origin-Opener-Policy
- X-Permitted-Cross-Domain-Policies
- Existing `nosniff` and strict-origin referrer policy retained

The invalid `X-Frame-Options: ALLOWALL` header was removed. The embed route retains an explicit `frame-ancestors *` policy. The application CSP allows only same-origin scripts plus the hash of the static JSON-LD block; styles allow the current Google Fonts and inline React styles.

### 10. Dependency remediation

Updated direct and transitive packages include:

- Mermaid to a patched `11.17.x` release
- React Router DOM to a patched `7.18.x` release
- PostCSS to patched `8.5.x`
- DOMPurify to patched `3.4.x`
- Browserslist, Nano ID, and baseline-browser-mapping to patched releases

As of 2026-10-05, `npm audit --omit=dev --audit-level=high` reports zero production vulnerabilities. A full development-tree audit reports five high findings through Tailwind 3's glob tooling because `braces <= 3.0.3` has a newly published stack-exhaustion advisory and no patched release. This code is used at build time and is not shipped in the production browser bundle. The Phase 2 plan tracks a Tailwind 4 migration or patched-upstream adoption rather than applying an unreviewed forced major upgrade.

### 11. Security tests

Files:

- `tests/security.test.cjs`
- `tests/offlineSync.test.cjs`
- `package.json`

Added regression coverage for:

- Valid bounded diagram content
- SVG-attribute injection through freehand paths
- Prototype-related keys
- Connections to nonexistent nodes
- Malicious share payloads
- Oversized encoded share payloads
- Compatibility with offline save canonicalization

## Verification performed

The following checks were run locally:

```text
npm audit --omit=dev --audit-level=high -> passed, 0 production vulnerabilities
npx tsc -b                       -> passed
npm run test:unit                -> passed, 23 tests
```

Additional verification:

```text
npm run build                     -> passed
npm run lint                      -> passed with seven pre-existing warnings
```

The production build retains the existing bundle-size warning for the main client chunk. The remaining lint warnings are existing React Fast Refresh and hook-dependency warnings outside this security change. The new pgTAP suite is checked in but could not run locally on 2026-10-05 because Docker Desktop was unavailable; it is configured to run in GitHub Actions.

## Required deployment steps

The SQL migration has been created but has **not** been applied to a remote Supabase project from this workspace.

Before deployment:

1. Back up the production database and review current policies in the Supabase dashboard.
2. Apply `supabase/migrations/20260924000000_security_hardening_phase1.sql` to staging.
3. Confirm the project has the expected `storage.buckets.file_size_limit` and `allowed_mime_types` columns.
4. Verify existing feedback attachment paths. The admin client supports both newly stored paths and legacy public URLs when creating signed URLs.
5. Test as four principals: anonymous, user A, user B, and administrator.
6. Verify user A cannot read or modify user B's projects/diagrams, even when IDs are known.
7. Attempt a direct API write containing more than 500 nodes and verify the database constraint rejects it.
8. Verify anonymous clients cannot list or fetch database diagrams.
9. Verify a self-contained `#d=` share URL still opens while an ID-only anonymous database URL does not.
10. Verify a suspended user cannot access project/diagram rows or upload files.
11. Verify an authenticated user can submit an attachment and an administrator can view it through a signed URL.
12. Verify direct inserts into `audit_logs` fail for `anon` and `authenticated`.
13. Deploy the frontend only after the migration succeeds, because the new client expects `log_user_activity` and private attachment policies.

## Known remaining work

The implementation sequence for these items is maintained in
[`SECURITY_PHASE_2_PLAN.md`](./SECURITY_PHASE_2_PLAN.md).

The following items are intentionally not represented as complete:

1. Add automated pgTAP/RLS tests under `supabase/tests` and run them in CI.
2. Replace self-contained URL sharing with optional revocable, expiring, hashed share tokens for large/private diagrams.
3. Add rate limiting and CAPTCHA/Turnstile to anonymous feedback, preferably through an Edge Function.
4. Decode and re-encode uploaded raster images server-side to verify signatures and remove metadata.
5. Delete old avatar objects after replacement and add retention cleanup for feedback attachments.
6. Move user deletion to an Edge Function using the service role so the Auth user and related data are removed correctly.
7. Revoke existing sessions when an account is suspended.
8. Add MFA/recent-auth requirements for administrator role changes and destructive operations.
9. Add CSP reporting and monitor violations before further narrowing `style-src` and `img-src`.
10. Add secret scanning, SAST, dependency review, and security tests to CI.
11. Review remaining `localStorage` data and offline queues for privacy retention and clear them on account removal/sign-out where appropriate.
12. Migrate from Tailwind 3 build tooling, or adopt a patched `braces` release when one becomes available, to clear CVE-2026-93687 from the development dependency tree.

## Reference standards

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

## Change-control note

Security-sensitive database behavior is enforced in SQL, not by React route guards or cached client roles. The Supabase anonymous key remains intentionally public; database grants, RLS policies, storage policies, and narrowly scoped RPCs are the security boundary.
