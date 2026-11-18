# Vyrnivo independent private worker

This repository includes a separately deployable authenticated media worker.

## Deploy

1. Choose an independent Docker-compatible host with an HTTPS domain and permitted outbound media access. Do not use the main Render service as the backup: that does not provide independent network access.
2. Deploy the repository using **Dockerfile.worker** and set **OWN_DOWNLOADER_TOKEN** to a unique randomly generated secret of at least 24 characters. Set PORT only if the host requires it. Never commit the token.
3. Verify `GET https://YOUR-WORKER/health` returns `{"ok":true,"service":"vyrnivo-media-worker"}`.
4. Confirm an unauthenticated `GET /api/downloads/status` returns HTTP 401. The token is required for all download endpoints.
5. On the **main Vyrnivo Render service**, set `OWN_DOWNLOADER_URL=https://YOUR-WORKER-DOMAIN` (HTTPS origin only, no trailing path) and `OWN_DOWNLOADER_TOKEN` to the same secret. Restart/deploy the main service.
6. Test with a short public video that you own or have permission to download. Check audio MP3, MP4, and requested video resolution. Compare actual bytes and playback, not only the UI's progress. Test unavailable sources and source rate limits too.

## Limitations

The worker uses yt-dlp and FFmpeg, not a newly licensed media API. Another host may still encounter YouTube restrictions. No worker or provider can guarantee every source will be accessible. This repository's mock tests verify the authenticated protocol and file transfer, **not** real YouTube availability. Do not publish a success claim without a real end-to-end media download.

## Safety and cost

The worker is a private server-to-server API, not a public download endpoint. Never expose the token in frontend JavaScript. Choose a provider whose outbound traffic and billing limits you understand. Keep the existing 200 MB/30-minute limits and 10-minute retention. Only download content you have permission to save.
