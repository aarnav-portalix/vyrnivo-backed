# Vyrnivo file hosting

Implemented, but external storage is disabled until runtime configuration is supplied. The published Sites Worker exposes an honest disconnected status. It does not execute this Node service. Deploy the Docker image separately (or host the entire app with it). This does not yet download media from YouTube/Instagram.

## Routing and retention

Gofile is attempted first. Catbox is an optional second provider, enabled only with its account userhash and confirmed permission for this use. Explicit upload refusals cause fallback with a cooldown; network timeouts and unknown responses halt for review, avoiding duplicate orphan files. Limits are respected; this is not account rotation or a rate-limit bypass.

At ten minutes after a successful upload, the app stops exposing its link and requests deletion on the next 15-second sweep. Deletion failures retry with backoff up to five minutes. The journal survives process restarts ONLY if mounted on durable storage. A suspended/offline host cannot promise physical deletion at ten minutes. An expired app link also cannot revoke a copied provider URL. Provider acknowledgement does not prove erasure from backups; Gofile's recycle bin must be disabled.

## Required runtime environment

- `APP_ORIGIN`: exact HTTPS origin serving this app.
- `FILE_HOSTING_ENABLED=true`
- `FILE_STATE_DIR=/data`: durable mounted volume, writable by UID 1000. One service replica only. Never use ephemeral Render free disk for this journal.
- `CLEANUP_TOKEN`: randomly generated server-only secret. An external scheduler may POST `/api/internal/cleanup` with `Authorization: Bearer <secret>` once per minute; it must actually run while the app is idle. The process also sweeps every 15 seconds and on startup. Verify this with a real uploaded test file before public use.
- `GOFILE_TOKEN`: one stable Gofile account token. No tokens in client code or Git.
- `GOFILE_RECYCLE_BIN_DISABLED=true`: set only after confirming this in the account.
- Optional `CATBOX_USERHASH`, `CATBOX_USAGE_APPROVED=true`: enable only once appropriate usage permission is confirmed.

No account credentials or scheduler have been provisioned. Free hosting with durable storage and unattended execution still needs to be selected and connected. The root Render manifest runs search/UI only by default; it is not sufficient to enable file hosting.

## Routes

GET `/api/files/status`; POST `/api/files/upload` with a raw audio/video body, MIME Content-Type, percent-encoded X-File-Name, and same-origin browser Origin header; GET `/api/files/<random-id>` for status. Maximum 50 MB, one active upload. Successful IDs are unguessable bearer references; do not publish private content. Gofile links open its download page; this does not circumvent its premium direct-link feature.

Upload lifecycle records are in `/data/files.json`, mode 0600. `needs-review` records indicate interrupted or ambiguous uploads; inspect the provider account and remove any orphan before marking resolved. Back up the journal, keep credentials stable, and drain pending jobs before shutting down a provider.

## Instagram keyword search

Set `SEARXNG_URL` to an HTTPS instance you operate or have permission to use with JSON enabled. Calls go through the same-origin backend, cache for 15 minutes, filter to canonical instagram.com/reel URLs, and cool down on 429. No automatic public-instance hopping. Search engine indexing is incomplete; embeds can fail. Without a configured instance the existing experimental Instagram topic lookup remains, with an explicit external web-search fallback. The embed player always keeps an original-link fallback.

## Validation

`node build.cjs`
`node --test hosting/files.test.mjs hosting/searx.test.mjs`
`PORT=10000 node hosting/server.mjs`

Tests use fake providers and clocks; they verify fallback, expiry, deletion retries and restart recovery. They do not establish live provider acceptance or deletion.

## Actual downloader (new)

`hosting/downloads.mjs` runs yt-dlp and FFmpeg (installed by the Dockerfile), accepts only single YouTube video / Instagram post URLs, and serves completed bytes from `/api/downloads/<id>/file`. Enable with `DOWNLOADS_ENABLED=true`. One conversion at a time; maximum output 200 MB, maximum duration 30 minutes, three-minute processing deadline. Incompatible container/codec choices can fail; the service returns a useful error and does not pretend completion. Audio bitrate preferences other than best are not implemented.

The direct download path requires no third-party storage credentials or durable disk. Temporary files expire after ten minutes, are removed by a five-second sweep, and are discarded on service restart. These are ephemeral download links, not permanent storage. If optional external file hosting is fully configured, completed files under 50 MB are also passed into its upload/fallback pipeline. That external pipeline still requires durable cleanup state and provider credentials.

The Render free manifest now enables this downloader and generates `DOWNLOAD_API_TOKEN`. After deploying, set the Sites server environment `DOWNLOAD_BACKEND_URL` to that backend HTTPS origin and `DOWNLOAD_BACKEND_TOKEN` to the same token. The Worker forwards download/file API requests server-side, including streamed file responses. Never place the token in React code. No Render account is connected yet; this configuration has not been deployed there.

Instagram no longer queries the broken `/popular/` route when SearXNG is unconfigured. The button explicitly opens an indexed web search instead. Set an authorized `SEARXNG_URL` on the Sites runtime to enable in-app search.

Validation: seven automated tests passed, including exact byte streaming from a prepared fixture. A real YouTube extraction from this execution environment was blocked by TLS certificate validation, so real source downloads remain unverified. This is not a claim that cloud-provider IPs will be accepted by YouTube/Instagram.
