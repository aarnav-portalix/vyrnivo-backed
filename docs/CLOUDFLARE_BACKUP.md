# Phase 12–14: independent emergency website

## Recommended provider
Cloudflare Pages is a suitable free static-hosting option for the emergency page at `backup-site/index.html`. It is a different hosting provider from Render, but **it is not a replacement for Vyrnivo's Python/ffmpeg/yt-dlp backend**. The emergency page must not promise downloads during a backend outage.

## One-time setup
1. Create a Cloudflare account (if you do not already have one) and create a Pages project named **vyrnivo-backup**. Choose a Direct Upload project if using the workflow; a Git-connected project may be managed separately.
2. In Cloudflare, create an API token with the minimal **Cloudflare Pages Edit** permission scoped to the appropriate account. Keep it private.
3. In the GitHub repository settings, create Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Do not paste either into code or chat.
4. Run the **Deploy emergency site to Cloudflare Pages** workflow manually or push a change to `backup-site/`. The workflow requires the project to exist first.
5. Open the resulting `*.pages.dev` address and confirm the emergency page loads. Test the main website link.
6. Keep the backup address separate from the Render hostname. Optionally attach a domain you control to the backup Pages project.

## Monitoring
`.github/workflows/uptime-check.yml` checks the Render homepage and `/health` every six hours. A GitHub Actions failure is a **signal**, not proof of an outage; free services may be asleep. This check does not prove that any particular download format works, and it does not automatically change DNS.

## Recovery boundaries
The backup is a separate **static** site, not a working media downloader. A real backend failover requires a second container-capable provider, independent source storage, deployment configuration, and authorized end-to-end tests. Cloudflare Pages does not make GitHub itself an independent code backup. Keep a Git mirror in a different storage account.
