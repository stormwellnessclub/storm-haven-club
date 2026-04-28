## Problem

In Front Desk mode, expanding a class row shows nothing under the roster — only the `8/10` enrollment badge on the parent row is visible. So it looks like "I just see how many people are booked."

Root cause: the `kiosk_class_roster(p_session_id uuid)` RPC references `p.avatar_url` from the `profiles` table, but that column does not exist. Calling the function throws:

```
ERROR: 42703: column p.avatar_url does not exist
```

`KioskClassRoster` catches the error in React Query and renders nothing useful, while the parent card keeps showing the enrollment count. This affects every place that uses this RPC (Front Desk, Reception kiosk, Classes kiosk).

## Fix

Single migration to recreate `public.kiosk_class_roster` without the bad column reference. Use only `members.photo_url` for the avatar (the `profiles` table has no avatar column). Logic and return shape are otherwise unchanged.

```sql
CREATE OR REPLACE FUNCTION public.kiosk_class_roster(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_to_json(r.*) ORDER BY r.name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      cb.id AS booking_id,
      COALESCE(
        NULLIF(TRIM(COALESCE(m.first_name,'') || ' ' || COALESCE(m.last_name,'')), ''),
        NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''),
        NULLIF(TRIM(COALESCE(nmp.first_name,'') || ' ' || COALESCE(nmp.last_name,'')), ''),
        NULLIF(cb.walk_in_name, ''),
        CASE
          WHEN cb.walk_in_email <> '' THEN 'Guest – ' || cb.walk_in_email
          WHEN p.email <> ''          THEN 'Guest – ' || p.email
          WHEN nmp.email <> ''        THEN 'Guest – ' || nmp.email
          ELSE 'Unknown'
        END
      ) AS name,
      cb.status,
      cb.checked_in_at,
      m.photo_url AS photo_url
    FROM class_bookings cb
    LEFT JOIN members m              ON m.id = cb.member_id
    LEFT JOIN profiles p             ON p.user_id = cb.user_id
    LEFT JOIN non_member_profiles nmp ON nmp.user_id = cb.user_id
    WHERE cb.session_id = p_session_id
      AND cb.status IN ('confirmed','completed')
  ) r;
  RETURN v_result;
END;
$$;
```

No frontend changes needed — `KioskClassRoster` already renders names, photos, and per-attendee Check In buttons as soon as the RPC returns data.

## Verification

After the migration, expanding a class in Front Desk → Today's Classes will show each booked attendee with name, avatar (members only), and an inline Check In button, matching the existing Kids Care / Spa kiosk patterns.