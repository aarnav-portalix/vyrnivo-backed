# Vyrnivo backup and recovery playbook

## What is backed up?
- Source code snapshot: Git branch `backup/stable-snapshot-20261118` in the primary repository. This is a rollback reference **not an independent backup**.
- Export a full copy regularly to a different account or storage provider, including Git history: `git clone --mirror https://github.com/aarnav-portalix/vyrnivo-backed.git`. Store the resulting `.git` mirror outside GitHub. Refresh with `git remote update --prune` and verify with `git fsck --full`.
- An alternative is GitHub's repository ZIP, but that excludes full Git history and is not sufficient by itself.

## Deploy a clean copy
1. Create a separate private repository or independent Git mirror and push a verified copy.
2. Deploy it on an independent provider using the included Dockerfile; the container listens on `PORT` (default 10000).
3. Configure `DOWNLOADS_ENABLED=true` only if media extraction is explicitly permitted and the provider supports Python, ffmpeg and yt-dlp.
4. Configure any private API tokens, optional provider credentials, and verification keys in the deployment dashboard; **never commit secrets**.
5. Visit `/health` for liveness and `/ready` for downloader readiness. A healthy web UI does **not** prove upstream media providers work.
6. Test a permitted sample download in each supported format before routing users to the backup.

## Failover
- Put a domain you control in front of the primary deployment; keep the backup hostname separate.
- If the primary fails, update the domain's DNS or provider routing to the verified backup. DNS failover is not instant; allow for TTL and caching.
- Do not claim automatic failover without a configured external health monitor and DNS automation.
- If a hosting provider removes service for a policy violation, resolve the underlying issue instead of using backups to evade enforcement.

## Data limitations
- Temporary media and job progress are intentionally ephemeral; a redeploy or failover cannot restore in-progress downloads.
- Git history does not back up provider dashboards, environment variables, DNS settings, or secrets. Record configuration names separately and keep credentials in a secure password manager.
- Schedule periodic independent exports and recovery drills. This repository alone is not disaster recovery.

## Automated recovery drill (Phase 11)
The `.github/workflows/recovery.yml` workflow runs weekly and on demand. It creates a full-history mirror, verifies Git integrity, saves a 30-day GitHub Actions artifact, restores the source into a fresh directory, executes backend regression tests, builds the Docker image, and verifies the recovered site responds correctly to `/health` and `/ready` with downloads disabled.

**Important:** GitHub Actions artifacts are stored within GitHub and are **not** an independent offsite backup. They can also expire. To protect against GitHub being unavailable, export the verified archive to a separate provider/account and test restoring it there. A second Render service is not independent of Render outages; use a separate hosting provider for genuine failover.

### External deployment checklist
- [ ] Select an independent hosting provider and an offsite storage destination
- [ ] Export a verified mirror to offsite storage
- [ ] Deploy the included Dockerfile from the restored mirror
- [ ] Configure secrets in the new provider's dashboard (never in Git)
- [ ] Confirm `/health` returns 200, and `/ready` accurately reports downloader configuration
- [ ] Run authorized sample downloads to validate actual media processing
- [ ] Configure a controlled domain cutover and test switching back
- [ ] Repeat the recovery drill periodically
