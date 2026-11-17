# Vyrnivo first-party conversion API and webhooks

Vyrnivo's own media converter runs on its Node/FFmpeg backend. It does not depend on an external conversion API. The publicly visible converter remains available and unchanged, while this private API is for trusted integrations.

## Authentication

A private bearer token is required for every `/api/private/*` call. The service uses the Render environment variable `VYRNIVO_PRIVATE_API_TOKEN` when set, or falls back to the existing server-only `DOWNLOAD_API_TOKEN`. This secret is never included in the web app bundle or browser API responses. Rotate the token if compromised. Never commit or paste a secret into a repository or public issue.

## First-party routes

All routes are on the existing `https://vyrnivo-downloads.onrender.com` service:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/private/status` | Check authenticated API availability |
| POST | `/api/private/conversions` | Start an allowed conversion job |
| GET | `/api/private/conversions/{jobId}` | Inspect job progress and approximate time remaining |
| GET | `/api/private/conversions/{jobId}/file` | Receive the generated media file |

Use `Authorization: Bearer <server-only token>` with every private request.

A conversion POST accepts a small JSON body:
```json
{"url":"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4","output":"MP4"}
```

It responds with HTTP 202 and a job ID. Poll the job URL to see `state` (processing, ready, failed, expired), `stage`, `progressPercent`, `estimatedSecondsRemaining` (an approximate value), and the generated file location. Status fields are not precise predictions when the network is slow.

**Safety and operating limits:** The same public-media host allowlist, redirect rejection, source validation, 30 MB input cap, 80 MB output cap, 2-minute conversion runtime, single active conversion at a time, and ten-minute retention apply. It is not an arbitrary URL proxy. File IDs are random and hard to guess, but a shared temporary public file link can be used by anyone who possesses it; keep sensitive content off Vyrnivo.

## Conversion speed

The server checks codecs using FFprobe. If the source already has compatible H.264/AAC MP4 streams or MP3 audio, it uses FFmpeg stream-copy (no full re-encode). Otherwise it uses the tested fast-transcode path with a limited worker thread count. A failed stream copy automatically falls back to re-encoding. This can save time on compatible media but does not speed up remote source servers or guarantee a conversion duration.

## Signed webhooks (optional)

For an operator-controlled receiver, configure these **private Render environment variables**:
- `VYRNIVO_WEBHOOK_URL`: the HTTPS URL to receive completion events. Only an operator-configured public hostname is accepted; visitors cannot choose webhook destinations.
- `VYRNIVO_WEBHOOK_SECRET`: a strong random signing secret. Never expose it to browsers.

After a job finishes (success or failure), Vyrnivo POSTs JSON:
```json
{"type":"conversion.completed","id":"<job UUID>","state":"ready","bytes":1024,"method":"stream-copy","completedAt":1790000000000}
```

The headers include:
- `x-vyrnivo-timestamp`: Unix timestamp in **milliseconds**
- `x-vyrnivo-signature`: `sha256=<hex HMAC-SHA256>`

Verification formula: HMAC-SHA256 keyed by `VYRNIVO_WEBHOOK_SECRET` over `timestamp + "." + exact_raw_request_body`. Verify in constant time; reject old timestamps and untrusted destinations. Do not reconstruct the JSON before verifying because the exact bytes matter. Delivery is best effort with a short timeout; a webhook failure never causes a user's conversion to fail.

## Cloudflare human verification

The existing Cloudflare Turnstile integration protects public YouTube download submissions when both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are configured on Render. It validates each token server-side. No challenge can be presented until you create a Cloudflare widget and provide its keys. The private converter API is already bearer-authenticated; do not expose its token to client-side code.

## Current privacy and deployment

Rendered FFmpeg output is temporarily stored on Vyrnivo's own server; the app does not store an account identity, and all media expires. In addition to application limits, Render's free plan has resource and uptime constraints.

Run `npm ci && npm run build`, followed by `node --test --test-concurrency=1 hosting/*.test.mjs`, before deploying. No security system is guaranteed unhackable.
