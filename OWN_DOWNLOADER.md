# Vyrnivo Private Download Engine

This is Vyrnivo's **own downloadable backend**, not a third-party hosted API.
It implements an authenticated HTTPS job protocol and runs its own yt-dlp and FFmpeg
to process supported public YouTube and Instagram media when the source permits access.

The existing public download flow remains unchanged unless a separate worker
is connected. The previously working external backup stays available during
migration and can be turned off later if the owned worker reliably handles
actual authorized downloads.

## What this does—and does not—replace

- **We control the application and API:** job submission, media preparation, progress,
  temporary output, security token, and retention are implemented in this repository.
- **No WebDownloader credentials are required for the owned worker.** It doesn't call
  WebDownloader, Piped, Invidious, Cobalt or another public download API.
- It does still rely on **yt-dlp and FFmpeg**, which are open-source dependencies,
  and on source platforms permitting access to particular media.
- Hosting this code on the same Render IP ranges as the current server **does not
  solve YouTube HTTP 429/403**. It is a portability and independence upgrade,
  not a way around platform blocks.
- A free 24/7 independent host is **not included or guaranteed**. Free platforms can
  sleep, restrict usage, or use IPs blocked by the source. Your PC is not required
  when the worker runs on a cloud host.

## Deploy your own worker separately

1. Choose a cloud host that supports an always-running-or-on-demand Docker web app,
   with enough resources for Python, FFmpeg, temporary files and media transfer.
   Check its free limits and permitted use; **test real source access** before
   relying on it. This worker can use a different host from the public Vyrnivo app.
2. Deploy **this same repository** as a separate service, using
   **`Dockerfile.owned-worker`**, not the regular public website Dockerfile.
3. Configure a strong, random `OWN_DOWNLOADER_TOKEN` (minimum 24 characters)
   as a **private environment variable** on the worker. Do not commit or publish it.
4. Confirm the worker's `GET /health` returns
   `{"ok":true,"service":"vyrnivo-media-worker"}`. All download endpoints
   require a matching server-only Bearer token.
5. On the **existing Vyrnivo Render service**, add these **protected environment
   variables**:
   - `OWN_DOWNLOADER_URL`: the worker's public **HTTPS origin** only, for example
     `https://your-owned-worker.example.org` (no path or credentials).
   - `OWN_DOWNLOADER_TOKEN`: **exactly the same private secret** as the worker.
6. Redeploy the public Vyrnivo app. The public download button now tries your
   private worker, while retaining the local extractor and the current external
   fallback if the worker is unreachable, unavailable or blocked.
7. Test an authorized public YouTube clip **and** an authorized public Instagram
   video before disabling any existing fallback. Check bytes and output playback,
   not just a 200 response.

The public site never exposes `OWN_DOWNLOADER_URL` or the token to browsers.
No new visitor login or API key is needed.

## Private protocol

Only `GET /health` is public; every other endpoint requires
`Authorization: Bearer <private-secret>` and uses HTTPS:

| Method | Endpoint | Behavior |
| --- | --- | --- |
| POST | `/api/downloads` | Start an allowed video extraction job |
| GET | `/api/downloads/{uuid}` | Check job stage, progress, error or readiness |
| GET | `/api/downloads/{uuid}/file` | Stream the prepared media file |
| GET | `/api/downloads/status` | Internal status diagnostics |

The request accepts the same limited `url`, `mode`, `quality` and
`container` properties as the Vyrnivo website. The worker only supports
validated single-video YouTube and public Instagram URLs, not arbitrary URLs.
It does not support account cookies, private sources, DRM bypass or unrestricted
HTTP proxying.

The worker limits output to 200 MB, duration to 30 minutes, one active
extraction at a time, and about three minutes of extraction time; generated
files expire in ten minutes. The main server downloads verified media bytes
into its own temporary storage, maintaining the existing site behavior.

## Provider outage strategy

A privately owned worker can still get HTTP 429, 403 or source verification
errors. Vyrnivo gives that worker an appropriate cooldown, then continues to
its existing download engine and backup if they are available. The worker is
**not** contacted repeatedly during that cooldown.

Do not remove the existing fallback until an independently hosted worker has
proven reliable over real downloads and with the source platforms' requirements.

## Security and operational limits

- All media processing endpoints on the standalone worker require a secret.
- Token remains in server-to-server requests only; browser code does not use it.
- The worker validates input URLs, uses non-shell process arguments, imposes
  timeouts, and stores random temporary job files.
- The main app only connects to a fixed operator-configured HTTPS origin.
  It does not follow arbitrary cross-origin redirects or trust remote file URLs.
- Cloudflare Turnstile remains the public site's separate optional anti-bot
  gate. Its keys must be configured independently in Render.
- No service can be guaranteed unhackable or permanently free.

## Verify before deploying

```bash
npm ci
npm run build
node --test --test-concurrency=1 hosting/*.test.mjs
```

The adapter tests cover authentication, safe requests, remote job polling,
strict media size/name verification, and fallback behavior. They do not assert
that an unconfigured independent hosting service already exists.
