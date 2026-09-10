# Diagrid Custom Email Templates for Supabase

These email templates replace Supabase's default plain-text emails with custom **Diagrid technical blueprint** branded templates.

## Files
1. **[confirm-signup.html](file:///c:/Users/sadia/diagrid/supabase/email-templates/confirm-signup.html)**: Sent when new users register to verify their email address.
2. **[reset-password.html](file:///c:/Users/sadia/diagrid/supabase/email-templates/reset-password.html)**: Sent when a user requests a password reset.
3. **[magic-link.html](file:///c:/Users/sadia/diagrid/supabase/email-templates/magic-link.html)**: Sent for passwordless one-click sign in.
4. **[invite-user.html](file:///c:/Users/sadia/diagrid/supabase/email-templates/invite-user.html)**: Sent when inviting collaborators or administrators.

---

## How to Apply in Supabase

1. Open your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. In the left navigation, go to **Authentication** &rarr; **Email Templates**.
3. For each template:
   - Click on the template name (e.g., **Confirm signup**).
   - In the **Message Body** editor, switch to or paste the entire contents of the matching `.html` file.
   - Click **Save Changes**.

---

## Design Features
- **Cross-client compatibility**: Table-based responsive layout supporting Gmail (Web, iOS, Android), Apple Mail, and Outlook.
- **Diagrid Brand Theme**: Crisp `#15191C` dark ink header with `[+] diagrid` logo, monospace technical subheadings, and hard-shadow buttons (`#1E5C8C` blueprint shadow).
- **Security Safeguards**: Fallback plain-text URL box for clients that disable button clicks, along with expiration notices.
