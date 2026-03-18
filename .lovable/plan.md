

## Plan: Generate VAPID Keys and Wire Up Push Notifications

VAPID keys are cryptographic keys needed for web push notifications. You don't need to create or find them — I'll generate a fresh pair and configure everything.

### What I'll do

1. **Create an edge function** (`generate-vapid-keys`) that generates a new VAPID key pair using the Web Crypto API
2. **Run it once** to produce a public + private key
3. **Store the private key** as a secret in your backend (you'll just paste the generated value when prompted)
4. **Update the public key** in `usePushNotifications.ts` to match the new pair
5. **Create the `send-push-notification` edge function** that staff can trigger for emergency messages — this function reads the private key from secrets and sends push notifications to parents

### How it works (non-technical summary)

- Push notifications require a matched pair of keys (like a lock and key)
- The public key lives in your app code (visible, that's fine)
- The private key is stored securely in your backend so only your server can send notifications
- When staff sends an urgent message, the backend uses the private key to push an alert to the parent's phone/browser

### Steps

1. Create `send-push-notification` edge function using the `web-push` protocol
2. Generate a VAPID key pair inside the edge function or via a one-time script
3. Prompt you to save the private key as a secret (I'll give you the value to paste)
4. Update the public key constant in `src/hooks/usePushNotifications.ts`
5. Wire the emergency chat UI to call the push notification function when staff marks a message as urgent

