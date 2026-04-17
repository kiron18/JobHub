# Granting Dashboard Access to a Member

## Overview

Dashboard access (the paid/premium area of JobHub) is controlled by the `dashboardAccess` field on each user's `CandidateProfile` in the database. There are two ways to grant access: responding to a user's in-app request (the normal flow), or granting it manually.

---

## Normal Flow — User Requests Access

1. The user clicks **"Request Access"** inside the JobHub app and enters their Skool email when prompted.

2. You receive an email at `admin@aussiegradcareers.com.au` with the subject:
   > `Dashboard access request — [Name or email]`

3. The email contains:
   - The user's name, JobHub email, Skool email, and target role
   - A pre-filled SQL command, e.g.:
     ```sql
     UPDATE "CandidateProfile" SET "dashboardAccess" = true WHERE "userId" = 'abc-123-...';
     ```
   - A direct link to the Supabase SQL editor for your project

4. **To approve:** Copy the SQL command, open the Supabase SQL editor link, paste it in, and click **Run**.

5. **To deny:** No action needed.

---

## Manual Grant (No In-App Request)

If you need to grant access without waiting for the user to request it:

1. Go to the [Supabase Dashboard](https://supabase.com/dashboard) and open your project.
2. Navigate to **SQL Editor** (left sidebar).
3. Run one of the following:

   **By user ID** (preferred — use the ID from the access request email if you have it):
   ```sql
   UPDATE "CandidateProfile" SET "dashboardAccess" = true WHERE "userId" = 'paste-user-id-here';
   ```

   **By email address** (use if you don't have the user ID):
   ```sql
   UPDATE "CandidateProfile" SET "dashboardAccess" = true WHERE "email" = 'user@example.com';
   ```

4. Check the result. Supabase may show this in different ways:
   - `1 row affected` or `Success. 1 rows` = access granted correctly
   - `0 rows affected`, `Success. 0 rows`, or `Success. No rows returned` = **the profile does not exist yet** — this is NOT a success

   If you get 0 rows / no rows returned: the user has not completed onboarding in the app yet. Ask them to open JobHub and finish the intake questionnaire — that creates their profile. Then run the SQL again.

---

## Revoking Access

To remove access (e.g. if a member cancels their Skool subscription):

```sql
UPDATE "CandidateProfile" SET "dashboardAccess" = false WHERE "userId" = 'paste-user-id-here';
```

Note: The Make → Skool webhook handles this automatically for subscription cancellations. Manual revocation is only needed in edge cases.

---

## Automatic Flow (via Skool/Make Webhook)

When a Skool member upgrades to Premium, Make sends a webhook to JobHub that automatically flips `dashboardAccess = true`. No manual SQL is needed in this case. The manual SQL process only applies when the webhook doesn't fire (e.g. a member was grandfathered in, or there's a sync issue).
