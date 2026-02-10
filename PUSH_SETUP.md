# Push notifications (free, no paid service)

Push works when the app is **closed** (e.g. on mobile). It uses the standard Web Push protocol—no third-party paid service.

## 1. Install dependency

```bash
npm install web-push
```

## 2. Generate VAPID keys (one-time)

```bash
npx web-push generate-vapid-keys
```

You’ll get a **public** and **private** key.

## 3. Set env on Vercel

In your Vercel project → **Settings** → **Environment Variables**, add:

| Name                           | Value                                   |
| ------------------------------ | --------------------------------------- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | The **public** key from step 2          |
| `VAPID_PRIVATE_KEY`            | The **private** key from step 2         |
| `VAPID_EMAIL`                  | Optional, e.g. `mailto:you@example.com` |

Redeploy so the new env is applied.

## 4. HTTPS and service worker

- Push only works over **HTTPS** (Vercel provides this).
- The app registers the service worker at `/sw.js` and subscribes with the public key; the server stores subscriptions in MongoDB and sends pushes when a new message is created.

No payment or external push service is required.
