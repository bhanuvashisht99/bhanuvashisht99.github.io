# Supabase Setup Guide

## Step 1: Create Supabase Account (5 minutes)

1. Go to https://supabase.com
2. Click **"Start your project"**
3. Sign up with GitHub, Google, or email
4. Verify your email if needed

## Step 2: Create New Project

1. Click **"New Project"**
2. Fill in:
   - **Name**: `nutrition-system` (or your preference)
   - **Database Password**: Generate a strong password (SAVE THIS!)
   - **Region**: Choose closest to your users (e.g., `US West` for USA)
   - **Pricing Plan**: **Free** (500MB database, 1GB storage)

3. Click **"Create new project"**
4. Wait 2-3 minutes for project to initialize

## Step 3: Get Your Credentials

Once project is ready:

1. Go to **Settings** (gear icon) → **API**
2. Copy these values (you'll need them):

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGc.................... (long string)
service_role key: eyJhbGc.................... (KEEP SECRET!)
```

3. Save these to `/Users/leo/bhanuvashisht99.github.io/.env`:

```bash
# Add these to your existing .env file
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc....................
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc.................... # For server-side only
```

## Step 4: Run Database Schema

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `database-schema.sql` (I'll create this next)
4. Paste into the SQL editor
5. Click **"Run"** (or press Ctrl/Cmd + Enter)
6. Should see: "Success. No rows returned"

## Step 5: Enable Email Authentication

1. Go to **Authentication** → **Providers**
2. **Email** should be enabled by default
3. Configure email settings:
   - Go to **Authentication** → **Email Templates**
   - Optionally customize confirmation and reset emails
4. For production, set up **SMTP** (optional for now):
   - Go to **Settings** → **Authentication** → **SMTP Settings**
   - Use your existing Gmail SMTP or SendGrid

## Step 6: Set Up Storage (for recipe images)

1. Go to **Storage** (left sidebar)
2. Click **"Create a new bucket"**
3. Bucket name: `recipe-images`
4. **Public bucket**: Yes (so images can be displayed)
5. Click **"Create bucket"**

## Step 7: Verify Setup

In SQL Editor, run this test query:

```sql
-- Should return empty table (no errors)
SELECT * FROM profiles LIMIT 1;
```

If you see the table structure with no errors, you're ready!

## Next Steps

Once you complete these steps, let me know and I'll:
1. Install the Supabase client library
2. Create the frontend authentication system
3. Build the food import script
4. Start populating the database

---

## Quick Troubleshooting

**Can't see tables after running schema?**
- Refresh the page
- Go to **Table Editor** → Should see all 14 tables

**Getting permission errors?**
- Make sure you're using the **anon** key for frontend
- Use **service_role** key only for server-side operations

**Email confirmation not working?**
- Check spam folder
- For testing, disable email confirmation:
  - **Authentication** → **Settings** → **User Signups** → Turn off "Enable email confirmations"

---

**Estimated time: 10-15 minutes total**

Let me know when you're done and I'll continue with the code! 🚀
