# Google and GitHub sign-in setup

The sign-in buttons in `src/pages/Auth.tsx` already call Supabase OAuth. Apply
`supabase/migrations/20260913000000_secure_oauth_signup.sql` to an existing
Supabase project before enabling either provider. New accounts then start with
the `user` role; existing admin profiles keep their stored role.

## Supabase redirect URLs

In Authentication > URL Configuration, set the Site URL to the production site
and add these exact Redirect URLs (adjust the production hostname):

- `http://localhost:5173/dashboard`
- `https://your-production-domain/dashboard`

The app passes `${window.location.origin}/dashboard` as `redirectTo`. Each
provider's callback URL is different: copy it from Supabase Authentication >
Sign In / Providers. It has the form
`https://<project-ref>.supabase.co/auth/v1/callback`.

## Google

1. In Google Auth Platform, configure Audience and Branding, then create a
   **Web application** OAuth client.
2. Add `http://localhost:5173` and the production origin under Authorized
   JavaScript origins.
3. Add the **Supabase callback URL** under Authorized redirect URIs.
4. In Supabase Authentication > Sign In / Providers > Google, enable the
   provider and enter the Google Client ID and Client Secret.

## GitHub

1. In GitHub Developer settings, create an OAuth App. Use the production app
   URL for Homepage URL (or `http://localhost:5173` while testing locally).
2. Set Authorization callback URL to the **Supabase callback URL**.
3. In Supabase Authentication > Sign In / Providers > GitHub, enable the
   provider and enter the GitHub Client ID and Client Secret.

## Verify

Run `npm run dev`, then sign in with each provider at `/auth`. Confirm that a
new account lands on `/dashboard`, has a `user` profile, can sign out, and can
sign in again. Repeat against the staging deployment using its exact
`/dashboard` redirect URL. Do not place provider client secrets in `.env` or
any `VITE_` variable; those are browser-visible.

References: [Supabase Google](https://supabase.com/docs/guides/auth/social-login/auth-google),
[Supabase GitHub](https://supabase.com/docs/guides/auth/social-login/auth-github),
[Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
