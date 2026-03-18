

## Plan: Auto-Generate Push Keys (No Input From You)

I apologize for the back and forth. The issue was that I kept asking you to paste a secret key, which you understandably don't have and shouldn't need to deal with.

**New approach**: I'll handle everything automatically with zero input from you.

### What I'll do

1. **Create a `send-push-notification` edge function** that generates its own VAPID key pair on first use and stores both keys in a `system_config` database table — no secrets prompt, no copy-pasting
2. **Add a `system_config` table** to store the generated keys securely in the database
3. **On first call**, the function generates keys, saves them, and returns the public key
4. **Update `usePushNotifications.ts`** to fetch the public key from the backend instead of using a hardcoded constant
5. **Wire staff emergency messages** to trigger push notifications to parents

### Technical details

- VAPID keys will be generated using Web Crypto API inside the edge function (Deno runtime)
- Private key stays in the database, never exposed to the frontend
- Public key is fetched once by the frontend when subscribing to notifications
- The `send-push-notification` function will handle the actual Web Push protocol delivery
- A new `system_config` table with RLS (admin-only read) stores key-value config pairs

### Result

- You don't need to find, generate, or paste any keys
- Staff can send urgent Kids Care messages that push-notify parents
- Everything is self-contained and automatic

