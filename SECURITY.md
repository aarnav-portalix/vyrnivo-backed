# Vyrnivo security and anti-bot configuration

Vyrnivo is a public, account-free download utility. No website can be guaranteed impossible to hack. These protections reduce common risks without disabling existing downloads, video previews, discovery, the converter, or temporary links.

## Protections currently implemented

- Strict validation of public YouTube and Instagram URLs before processing; no arbitrary private-network media hosts in the downloader.
- One active extraction job per server instance, 200 MB output limit, 30-minute maximum duration, temporary random download URLs, and automatic expiry.
- Same-origin checks for browser writes; request-size checks; a bounded server request rate; and server request/header timeouts.
- Response headers against clickjacking, active browser plugins, unexpected form targets, MIME sniffing, and unnecessary browser capabilities.
- Optional Cloudflare Turnstile **before starting a new download**. The backend verifies tokens with Cloudflare Siteverify, validates expected hostname and the `download` action, rejects failed tokens, and does not put the secret key in browser code.
- The public online counter tracks approximate active sessions in memory; it does not store account profiles.

## Enable Cloudflare Turnstile on Render

Cloudflare Turnstile offers a managed challenge that can be used with a site hosted on Render; you do not have to migrate DNS to Cloudflare to embed it.

1. In Cloudflare's Turnstile dashboard, create a **Managed** widget for the exact hostname `vyrnivo-downloads.onrender.com`. If you later use a custom domain, add it in Cloudflare and update the hostname setting.
2. Obtain the **public site key** and **private secret key** for that widget.
3. In Render, open `vyrnivo-downloads` → **Environment** and add:
   - `TURNSTILE_SITE_KEY` = your **public** site key.
   - `TURNSTILE_SECRET_KEY` = your **private** secret key.
   - Optional `TURNSTILE_EXPECTED_HOSTNAME` = `vyrnivo-downloads.onrender.com` (already the default).
4. Save and redeploy the Render service. Check `/api/security/status` returns `{"enabled":true,"siteKey":"..."}`.
5. Open Vyrnivo, click **Download**, and verify that the challenge appears before the download job starts. Test on a phone and in a desktop browser.

**Never place the private secret key in GitHub, a URL, the UI, a screenshot, or a public document.** Set it only in Render's protected environment settings. Do not send it to visitors.

Until **both** keys are configured, Turnstile is disabled, and the established download flow remains unchanged. If Cloudflare verification is enabled but unreachable, new download submissions fail closed with a helpful error rather than bypassing security. Cloudflare tokens expire and can only be verified once.

### What Turnstile does and does not protect

- It checks a visitor **when starting a new download job**. Existing random download links still work for their ten-minute lifetime, including copied links. Requiring another challenge at the file URL would break the existing Copy Link feature.
- Managed Turnstile generally verifies automatically, with an interactive checkbox shown only if Cloudflare determines one is needed.
- It does not guarantee all visitors are human or protect against all vulnerabilities. Do not rely on a bot challenge alone.
- Cloudflare may process technical signals for security verification. Disclose this in the Privacy Policy (already included).

## Maintenance

- Keep Node.js, FFmpeg, Python, yt-dlp and other dependencies updated.
- Watch abuse patterns and apply reasonable limits without accidentally blocking legitimate visitors behind a shared proxy.
- Use a private security contact for sensitive vulnerability reports. A public GitHub issue must **not** include secrets, private media links or personal information.
- For a larger public launch, consider a proper domain and a managed WAF/security service, plus a professional vulnerability review.

## Tests

```bash
npm ci
npm run build
node --test --test-concurrency=1 hosting/*.test.mjs
```

These cover the production smoke route, permitted inputs, security headers, Turnstile validation logic, and core downloader behavior. A test suite cannot guarantee security against every attack.
