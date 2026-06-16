# Box-setup runbook — Linode VPS (issue A.2 / #42)

Ordered commands to provision the prototype host **once the owner has created the box and
provided SSH access**. Target: a fresh **Linode Nanode 1GB, Ubuntu 24.04 LTS**, serving the
Next.js Node SSR server (issue #37) at **`wikiplus.wikiedu.org`** via Docker Compose
(`app` + `caddy`).

This is run **once**. After it, the steady-state loop is fully automated: a push to `main`
builds the image in CI and SSH-deploys it (`.github/workflows/deploy.yml`) — no SSH needed.

## Prerequisites (owner provides)

- The box's public IP, and SSH access as a sudo-capable user (root or a sudo user).
- The deploy SSH key pair generated locally; **private** key at
  `~/.ssh/wikiplus_vps_ed25519`, the matching `.pub` authorized on the box for the deploy
  user. (Generate with `ssh-keygen -t ed25519 -f ~/.ssh/wikiplus_vps_ed25519 -C wikiplus-deploy`
  if it doesn't exist; add the `.pub` to the deploy user's `~/.ssh/authorized_keys`.)
- DNS: an **A record** (and AAAA if using IPv6) for `wikiplus.wikiedu.org` → the box IP.
  **See the Cloudflare check below before bring-up.**

### DNS / Cloudflare check (do FIRST — do not assume)

`wikiplus.wikiedu.org` is a subdomain of the `wikiedu.org` zone, which may already be in
Cloudflare. Confirm with the owner:

- If the record is created **DNS-only (grey cloud)** → Caddy reaches Let's Encrypt directly,
  HTTP-01 works, nothing extra to do. **(Simplest — recommended for the prototype.)**
- If the record is **proxied (orange cloud)** → set the zone's SSL/TLS mode to **Full** (NOT
  Flexible — Flexible causes a redirect loop), or switch Caddy to a **DNS-01** challenge with a
  Cloudflare API token (needs a custom Caddy image with the `caddy-dns/cloudflare` plugin — the
  fallback path; not built by default in `caddy:2`).

## 1. Connect

```sh
ssh -i ~/.ssh/wikiplus_vps_ed25519 <deploy_user>@<BOX_IP>
```

## 2. Update + firewall (ufw: allow 22/80/443, deny the rest)

```sh
sudo apt-get update && sudo apt-get upgrade -y

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH        # 22/tcp
sudo ufw allow 80/tcp         # HTTP (Caddy ACME HTTP-01 + redirect)
sudo ufw allow 443/tcp        # HTTPS
sudo ufw allow 443/udp        # HTTP/3 (QUIC)
sudo ufw --force enable
sudo ufw status verbose
```

(Optional hardening, recommended: disable SSH password auth — `PasswordAuthentication no` in
`/etc/ssh/sshd_config`, then `sudo systemctl restart ssh` — so only the deploy key works.)

## 3. Install Docker Engine + the compose plugin (official repo)

```sh
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Let the deploy user run docker without sudo (re-login or `newgrp docker` to apply):
sudo usermod -aG docker $USER

# Verify:
docker --version
docker compose version
```

> The 1GB box has no swap by default and the app is small; if memory ever gets tight,
> add a 1–2 GB swapfile. The box **never builds** Next.js (CI does), so build-time OOM is
> not a concern here — only the lightweight `docker compose pull` + runtime.

## 4. Place the deploy files at `/opt/wikiplus`

The box only needs `deploy/docker-compose.yml` (renamed to `docker-compose.yml`) and the
`Caddyfile`. Two options:

```sh
sudo mkdir -p /opt/wikiplus
sudo chown $USER:$USER /opt/wikiplus
cd /opt/wikiplus
```

**Option A — clone the public repo (simplest, keeps the box in sync):**
```sh
sudo apt-get install -y git
git clone --depth 1 https://github.com/ragesoss/wikiplus.git /tmp/wikiplus-repo
cp /tmp/wikiplus-repo/deploy/docker-compose.yml /opt/wikiplus/docker-compose.yml
cp /tmp/wikiplus-repo/deploy/Caddyfile /opt/wikiplus/Caddyfile
rm -rf /tmp/wikiplus-repo
```

**Option B — copy from the local machine (no git on the box):**
```sh
# run from a checkout on the local machine:
scp -i ~/.ssh/wikiplus_vps_ed25519 \
  deploy/docker-compose.yml deploy/Caddyfile \
  <deploy_user>@<BOX_IP>:/opt/wikiplus/
```

(The SSH deploy job `cd /opt/wikiplus && docker compose pull && docker compose up -d` expects
exactly these two files there. If the compose file's contents change in a later issue, re-copy
it — the workflow does not sync it for you.)

## 5. GHCR pull auth — make the package public (recommended), else `docker login`

The image is `ghcr.io/ragesoss/wikiplus`. The repo is **public**, so the cleanest setup is to
make the **GHCR package public** too — then the box pulls with **no auth**:

> GitHub → the `wikiplus` package (under the user/org Packages) → **Package settings** →
> **Change visibility** → **Public**. (The first CI push creates the package; set it public
> right after the first successful `build` job run.)

If the package is kept **private** instead, log the box in once with a **read-only PAT**
(classic PAT with `read:packages` scope, or a fine-grained token with package read):

```sh
echo "<GHCR_READ_PAT>" | docker login ghcr.io -u ragesoss --password-stdin
```

(Login persists in `~/.docker/config.json`, so the deploy job's `docker compose pull` then
works without re-auth. If public: **skip this step entirely.**)

## 6. First bring-up

```sh
cd /opt/wikiplus
docker compose pull        # pulls ghcr.io/ragesoss/wikiplus:latest + caddy:2
docker compose up -d
docker compose ps          # both app + caddy should be "running"
docker compose logs -f caddy   # watch for the Let's Encrypt cert being issued
```

Caddy obtains the TLS cert on first request to `wikiplus.wikiedu.org` (or proactively on
startup). The cert + ACME account persist in the `caddy_data` named volume.

## 7. Verify TLS + the live site

```sh
# From anywhere (or the box):
curl -sI https://wikiplus.wikiedu.org/ | head -n 5         # expect HTTP/2 200
curl -s https://wikiplus.wikiedu.org/ | grep -i "wiki+"    # the app HTML

# Cert chain / expiry:
echo | openssl s_client -connect wikiplus.wikiedu.org:443 -servername wikiplus.wikiedu.org 2>/dev/null \
  | openssl x509 -noout -issuer -dates
```

Then in a browser: `https://wikiplus.wikiedu.org/` (home renders), and an **unseeded** topic
deep link, e.g. `https://wikiplus.wikiedu.org/topic/San_Francisco/`, renders on demand (the
#37 SSR behavior, live). A valid Let's Encrypt cert (no warning) confirms TLS.

## 8. Done → auto-deploy takes over

Once the GitHub repo secrets are set (see below), a push to `main` builds + ships
automatically. To deploy by hand at any time: GitHub → Actions → **Build & deploy to VPS** →
**Run workflow**. To redeploy on the box directly: `cd /opt/wikiplus && docker compose pull &&
docker compose up -d`.

---

## GitHub repo secrets to set

Set under the repo → **Settings → Secrets and variables → Actions**, or with the `gh` CLI.
The workflow consumes exactly these:

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | The box's public IP (or `wikiplus.wikiedu.org` once DNS resolves). |
| `DEPLOY_USER` | The SSH deploy user on the box (the sudo/docker-group user from step 3). |
| `DEPLOY_SSH_KEY` | The **private** SSH key — the contents of `~/.ssh/wikiplus_vps_ed25519` (whose `.pub` is in the deploy user's `authorized_keys`). |
| `YOUTUBE_API_KEY` | The referrer-restricted YouTube Data API key, baked into the client bundle at build time (`--build-arg NEXT_PUBLIC_YOUTUBE_API_KEY`). Unset → live search no-ops. *(Carried over from the old Pages workflow.)* |

`GITHUB_TOKEN` is the built-in token GitHub injects automatically (used to push to GHCR) —
**do not set it**.

```sh
# Run from a checkout (the repo is the default target). DEPLOY_SSH_KEY reads the private key file:
gh secret set DEPLOY_HOST     --body "<BOX_IP>"
gh secret set DEPLOY_USER     --body "<deploy_user>"
gh secret set DEPLOY_SSH_KEY  < ~/.ssh/wikiplus_vps_ed25519
gh secret set YOUTUBE_API_KEY --body "<youtube_data_api_key>"   # if not already set on the repo
```

(`gh secret set NAME < file` reads the secret value from the file — the right way to load the
multi-line private key without it touching the shell history.)

## Operational notes

- **Backups:** the only stateful prototype data on the box is the `caddy_data` volume (the
  ACME account + issued certs). Losing it just re-issues certs on next start (rate-limited by
  Let's Encrypt — fine at this volume). Once Postgres lands (issue B), add a `pg_dump` backup
  job. No app data lives on the box yet (still localStorage, per-browser).
- **Logs:** `docker compose logs -f app` / `... caddy`. Caddy access logs are JSON on stdout.
- **GHCR image hygiene:** the deploy job runs `docker image prune -f` after each `up -d` so
  superseded `:<sha>` layers don't accumulate on the small disk.
- **No interactive access in the normal loop:** after this one-time setup, the routine
  prompt → staging loop never SSHes by hand — CI builds and the deploy job pulls + restarts.
