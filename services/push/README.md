# Optional push companion

This service is **not deployed** by GitHub Pages. It needs a Node.js 24+ host with HTTPS and a persistent volume. It does not need Supabase. Do not run it as a GitHub Actions cron: device registrations need a private durable store and an always-available API.

1. `cd services/push && npm ci`.
2. `npm run keys`; store the private key only in the server environment. Never commit it or expose it via NEXT_PUBLIC variables.
3. Set variables from `.env.example` in the host. `APP_ORIGIN` is the exact website origin, without a path. Mount `/data` on persistent storage; restrict volume access. Run `npm start` behind HTTPS. Node does not implicitly load `.env`.
4. Add an edge IP rate limit and request-size limit. Test invalid origins, unauthenticated requests and removal before enabling production traffic. Subscription endpoints/keys are sensitive; do not log request bodies or Authorization headers.
5. Configure the frontend build variables `NEXT_PUBLIC_PUSH_SERVICE_URL` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, rebuild Pages, then enable notifications from Settings using a real installed PWA. Verify on iPhone and Android while the app is closed. The service's validation tests do not prove end-to-end delivery.

`POST /subscribe` stores a subscription; `POST /schedule` replaces this device's entire pending schedule atomically; `DELETE /subscribe` deletes its data; `POST /test` sends one rate-limited neutral test. A random 256-bit bearer capability is generated per browser and only its hash is stored by the server. No account access, amount, category, merchant or payment name is transmitted. Client IDs are SHA-256 digests; the server receives only IDs and UTC delivery times. The browser stores the capability separately from financial backup JSON.

Jobs with the same ID are delivered at most once, including after resync. Batches are consolidated and limited to one per hour. The service claims jobs before sending; failed/crashed sends may be lost, intentionally preferring no duplicate spam. Invalid subscriptions are removed. Old devices expire after 45 days; delivered-ID retention is 400 days. SQLite WAL and its containing directory must be protected. Use an encrypted disk and encrypted backups where available.

The app syncs on edits, becoming visible, and reconnecting. Existing offline plans on the server cannot know that a payment was paid or changed until the next sync. Demo mode cancels the connected browser's pending schedule. Reminders are generic; a notification opens the local notification center. Financial warnings are calculated locally, so unseen financial changes cannot generate new warnings while the app remains closed. This is not a guaranteed alarm service.
