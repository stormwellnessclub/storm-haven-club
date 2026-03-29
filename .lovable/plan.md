

# Set Front Desk Kiosk PIN to 0201

## What
Set the kiosk PIN by calling the existing `set_kiosk_pin` database function with the value `0201`. This will hash and store the PIN so staff can unlock the front desk kiosk at `/front-desk`.

## How
Use the database insert tool to execute:
```sql
SELECT set_kiosk_pin('0201');
```

This calls the existing RPC which hashes the PIN and stores it in the `kiosk_settings` table.

