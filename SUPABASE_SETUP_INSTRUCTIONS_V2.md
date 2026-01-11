# Supabase Scheduled Functions Setup - Configuration Table Approach

This guide explains how to set up the database parameters required for scheduled functions (pg_cron jobs) using a **configuration table** approach that works with Supabase managed instances.

## Why This Approach?

Supabase managed instances **do not allow** `ALTER DATABASE SET` commands because:
- They require superuser privileges
- Supabase explicitly blocks this for security reasons
- Custom GUCs (Grand Unified Configuration) can only be set by superusers

Instead, we use a **configuration table** to store the values needed for cron jobs.

## Setup Steps

### Step 1: Run the Configuration Table Migration

The migration `20260108000003_scheduled_functions_config.sql` will create:
- A `scheduled_functions_config` table to store URL and anon key
- A `get_scheduled_functions_config()` function to retrieve the values
- Initial placeholder values

### Step 2: Update the Configuration Values

After running the migration, update the configuration with your actual values:

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this SQL to update the configuration:

```sql
-- Update with your actual values
UPDATE public.scheduled_functions_config
SET 
  supabase_url = 'https://cqzmrdzwgsujgbjqpoxh.supabase.co',
  anon_key = 'YOUR-ACTUAL-ANON-KEY-HERE',
  updated_at = now()
WHERE id = 'default';
```

**To get your anon key:**
- Go to **Settings** → **API**
- Under **Project API keys**, copy the **`anon` `public`** key

**Your Supabase URL:**
- Your project ID is: `cqzmrdzwgsujgbjqpoxh`
- Your URL is: `https://cqzmrdzwgsujgbjqpoxh.supabase.co`

### Step 3: Verify the Configuration

Run this query to verify the values are set:

```sql
SELECT 
  supabase_url,
  CASE 
    WHEN anon_key IS NOT NULL 
    THEN 'Set (hidden for security)' 
    ELSE 'Not set' 
  END AS anon_key_status,
  updated_at
FROM public.scheduled_functions_config
WHERE id = 'default';
```

### Step 4: Run the Scheduled Functions Migration

After the configuration is set, run the migration `20260108000001_configure_scheduled_functions_v3.sql` which will:
- Create the pg_cron jobs
- Use the configuration table to get URL and anon key values

## Migration Order

Make sure to run migrations in this order:

1. `20260108000003_scheduled_functions_config.sql` (creates config table)
2. Update the config values (using SQL UPDATE above)
3. `20260108000001_configure_scheduled_functions_v3.sql` (creates cron jobs)

## Security Notes

- The configuration table is **not** protected by RLS (disabled for this table)
- Access is restricted through the `get_scheduled_functions_config()` SECURITY DEFINER function
- Only the service role (used by pg_cron) can effectively use these values
- Regular users cannot read the anon key from the table

## Troubleshooting

- **Cron jobs failing?** Verify the URL and anon key are correct in the config table
- **Can't find anon key?** Make sure you're using the `anon` `public` key, not `service_role`
- **Migration errors?** Make sure you run the config table migration first

## Updating Values Later

To update the configuration values later:

```sql
UPDATE public.scheduled_functions_config
SET 
  supabase_url = 'new-url',
  anon_key = 'new-key',
  updated_at = now()
WHERE id = 'default';
```

The cron jobs will automatically use the new values on their next run.
