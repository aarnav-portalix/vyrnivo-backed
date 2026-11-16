# Vyrnivo — automatic temporary media downloads

## How Vyrnivo now works

1. Paste the URL of a **public YouTube video / Short** or **public Instagram Reel/post** that you own or have permission to download.
2. Vyrnivo asks the host's `yt-dlp`/FFmpeg service to retrieve and prepare the media.
3. When ready, the server **automatically hosts** the output in private temporary storage and returns `/api/downloads/<id>/file`. The user can download or copy this URL immediately. There is no extra upload step and **no public file-upload feature**.
4. **Ten minutes after completion**, the URL expires; a five-second sweep removes the file from this running server. Any host restart can delete it sooner. On a suspended host, deletion is delayed until service startup; links expire logically at the deadline.

Files are kept on the Render container's ephemeral disk, not permanently uploaded to Gofile or Catbox. The legacy `hosting/files.mjs` provider integrations are unused; public `/api/files/upload` and `/api/downloads/upload` endpoints return 410. URL IDs are long random bearer tokens, so sharing a URL shares its temporary access.

### Important reliability limits

- **Source access is not guaranteed.** Render's egress IP may receive YouTube HTTP 403/429 or Instagram login/permission barriers. These are upstream restrictions; a free hosting change or format preference cannot reliably fix them. The app shows the limitation rather than pretending success. Repeated requests during a confirmed YouTube 429 cooldown fail quickly.
- Video quality and duration affect download speed. The UI uses 720p as the initial speed-oriented preference, while higher resolutions remain selectable. Compatible MP4/WebM streams are preferred to avoid unnecessary conversion. FFmpeg is still needed when video and audio are separate.
- Maximum output 200 MB; maximum duration 30 minutes; one active extraction per server instance; 3-minute extraction deadline. Video download links expire ten minutes after preparation and may vanish on restart.
- Keyless Instagram keyword lookup attempts a **public search-index feed**. Indexing may return no Reels, or links may be stale. The UI includes an external web-search fallback. A user can always paste a direct publicly accessible Reel URL.
- Use only media you own or have rights to download; no DRM or access-control circumvention is included.

### Deploy

The Render service uses the repo `Dockerfile`, with `DOWNLOADS_ENABLED=true`. It runs the entire app (frontend + Node backend) on a single origin, e.g. `https://vyrnivo-downloads.onrender.com`; there is no requirement for a separate Sites backend token for users of this domain.

Run `npm ci && npm run build && node --test --test-concurrency=1 hosting/*.test.mjs` before deployment. Tests cover fixture extraction, ten-minute expiry, disabled arbitrary file uploads, access permissions, and search URL validation. They do **not** guarantee that YouTube and Instagram accept requests from Render.

After deployment check `/health`, `/api/downloads/status`, and the site's actual download flow using a video you have permission to retrieve. If the source returns 403/429, the code cannot fabricate a working download.
