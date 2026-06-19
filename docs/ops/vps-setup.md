# Box-setup runbook — Linode VPS (issue A.2 / #42)

Ordered commands to provision the prototype host **once the owner has created the box and
provided SSH access**. Target: a fresh **Linode Nanode 1GB, Ubuntu 24.04 LTS**, serving the
Next.js Node SSR server (issue #37) at **`wikiplus.wikiedu.org`** via Docker Compose
(`app` + `caddy`).

This is run **once**. After it, the steady-state loop is fully automated: a push to `main`
builds the image in CI and SSH-deploys it (`.github/workflows/deploy.yml`) — no SSH needed.

> **As shipped (2026-06-16):** the first prototype box came up on **Debian 13 (trixie)**, not
> Ubuntu 24.04. Docker's official convenience script handled it cleanly (see §3), and the rest
> of the runbook applied unchanged. A non-root **`deploy`** user runs the stack; `DEPLOY_USER`
> = `deploy`. Two deviations from the steps below were observed in practice — noted inline at
> §3 (install method) and §5 (GHCR auth turned out to need *no* manual step).

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

> **On Debian 13 / non-Ubuntu, or to avoid the codename dance:** Docker's official convenience
> script is the simplest path and is what was used in practice —
> `curl -fsSL https://get.docker.com | sh` (installs Engine + the compose + buildx plugins,
> auto-detecting the distro). The explicit apt-repo steps below assume Ubuntu and pin
> `download.docker.com/linux/ubuntu`; swap `ubuntu`→`debian` for Debian if you prefer the repo
> route. Either way, then run the `usermod -aG docker` line.

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

> The 1GB box has little/no swap by default and the app is small; a **1 GB swapfile was added**
> as cheap OOM insurance (`fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile
> && swapon /swapfile`, plus an `/etc/fstab` entry). The box **never builds** Next.js (CI does),
> so build-time OOM is not a concern here — only the lightweight `docker compose pull` + runtime.

## 3b. Postgres bring-up (issue #45 — the shared data store)

As of **issue #45** the stack includes **Postgres** (the shared, multi-user data store) and a
one-shot **`migrate`** service that applies Drizzle migrations + the seed on deploy. Two secrets must
be placed on the box **once**, before the first deploy of the #45 image; after that the steady-state
loop is unchanged (push to `main` → CI build → SSH `docker compose up -d`, which now also migrates).

**Why two secret surfaces for one password (read this):** Postgres reads its password from a Docker
**secret file** (`POSTGRES_PASSWORD_FILE` → `/run/secrets/postgres_password`); the **app + migrate**
build their `DATABASE_URL` connection string from an **env var** (`POSTGRES_PASSWORD`, interpolated by
compose from `/opt/wikiplus/.env`). Put the **same** password in both places. The secret file never
leaves the box; the committed compose file contains **no** password (AC14).

```sh
cd /opt/wikiplus

# 1) The Docker secret FILE Postgres reads (chmod 600; never world-readable):
mkdir -p secrets
# Generate a strong password once and write it to the secret file:
openssl rand -base64 32 | tr -d '\n' > secrets/postgres_password
chmod 600 secrets/postgres_password

# 2) The .env compose reads to assemble the app/migrate DATABASE_URL. POSTGRES_PASSWORD MUST
#    equal the secret file's contents (the app connects with the same password Postgres expects).
printf 'POSTGRES_PASSWORD=%s\n' "$(cat secrets/postgres_password)" > .env
chmod 600 .env
```

- The app's `DATABASE_URL` is assembled by compose as
  `postgres://wikiplus:${POSTGRES_PASSWORD}@postgres:5432/wikiplus` (internal compose hostname; no
  published DB port). You do **not** set `DATABASE_URL` directly — only `POSTGRES_PASSWORD` in `.env`.
- **Migrations apply automatically on deploy.** `docker compose up -d --wait` brings up `postgres`,
  runs the `migrate` one-shot to completion (Drizzle migrations + the idempotent seed), then starts
  `app` + `caddy` (`app depends_on migrate: service_completed_successfully`). No manual migration step,
  no `next build` on the box. A failed migration makes the deploy exit non-zero (the app won't start
  against an unmigrated DB).
- To apply migrations by hand (rare): `cd /opt/wikiplus && docker compose run --rm migrate`.
- **`pgdata` is a persistent named volume** — curations survive restarts/redeploys. Add it to backups
  (see *Operational notes*).

> **First #45 deploy is special:** the box must have `secrets/postgres_password` + `.env` in place
> **before** the deploy job runs `docker compose up -d`, or compose will fail to interpolate
> `POSTGRES_PASSWORD` / mount the secret. Do §3b before re-pulling the #45 compose file (§4) and
> triggering the deploy.

> **The issue C deploy is stateful + owner-gated:** the owner must register the prod callback URL
> at meta.wikimedia.org (§3c) **and** the three runtime secrets must exist (as of issue #49, as
> GitHub Actions secrets — the deploy job injects them, see §3c). The `:?` guards in the compose
> file make `docker compose up -d --wait` **fail loudly** if any of the three is unset on the box —
> so the live site is not taken down by a half-applied deploy, but login will be broken until the
> callback is registered. Verify login live after the deploy (not just a green Actions run).

## 3c. OAuth runtime secrets — injected at deploy time (issues C + #49)

The app does **real Wikimedia OAuth 2.0** (Auth.js v5, JWT sessions). The `app` container reads
**three RUNTIME secrets** (read by `lib/auth/config.ts` + Auth.js at request time — **not** baked
into the image, unlike the build-time YouTube key). The values live in **GitHub Actions secrets**;
the **deploy job** (`.github/workflows/deploy.yml`) injects them into `/opt/wikiplus/.env` on the
box **before** `docker compose up -d`. So there is **no manual SSH step** to set or rotate them —
this is the automated, mobile-drivable flow. `deploy/docker-compose.yml` interpolates the `.env`
keys into the `app` service; the committed compose file carries **no** secret values, and a **`:?`
guard** on each makes `docker compose up -d --wait` **fail loudly** if any is unset — so a missing
secret is caught at deploy, never shipped as silently-broken login.

### Name mapping (GitHub secret → box `.env` key → consumer)

GitHub Actions secret names must match `[A-Z_][A-Z0-9_]*` (Actions stores them uppercased), so the
two OAuth secrets are stored UPPERCASE in GitHub but the deploy job writes the **lowercase** `.env`
keys the app/compose actually read. `AUTH_SECRET` is uppercase in both places.

| GitHub Actions secret | Box `.env` key (what the app reads) | What it is | Source |
|---|---|---|---|
| `AUTH_SECRET` | `AUTH_SECRET` | Auth.js JWT session signing/encryption. | `openssl rand -base64 32` (a fresh, strong value — never the dev `.env` value) |
| `WIKIMEDIA_OAUTH_CLIENT_KEY` | `wikimedia_oauth_client_key` | The Wikimedia OAuth **consumer key** (`clientId`). | The owner's registered consumer (meta.wikimedia.org) |
| `WIKIMEDIA_OAUTH_CLIENT_SECRET` | `wikimedia_oauth_client_secret` | The Wikimedia OAuth **consumer secret** (`clientSecret`). | Same consumer |

### Setting the secrets (one-time, owner action — the VALUES live only off-box)

The owner sets the three repo secrets (the values exist in the owner's hands / the box's current
`.env`, not in the repo). Run from a checkout:

```sh
# AUTH_SECRET: a fresh, strong value (do NOT reuse the local-dev value).
gh secret set AUTH_SECRET                   --body "$(openssl rand -base64 32 | tr -d '\n')"
gh secret set WIKIMEDIA_OAUTH_CLIENT_KEY    --body "<OWNER CONSUMER KEY>"
gh secret set WIKIMEDIA_OAUTH_CLIENT_SECRET --body "<OWNER CONSUMER SECRET>"
```

The next deploy (push to `main`, or **Actions → Run workflow**) injects them. The deploy job's
SSH step writes each into `/opt/wikiplus/.env` **idempotently** — replace-or-append, never
duplicating a key, `chmod 600`, leaving `POSTGRES_PASSWORD` (and any other key) untouched. Values
are passed as positional args to the writer, so `/`, `&`, `=`, and other special chars are handled
literally, and the values are never echoed to the deploy log.

### Rotation (no SSH)

To rotate any of the three: update the GitHub secret, then redeploy.

```sh
gh secret set AUTH_SECRET --body "$(openssl rand -base64 32 | tr -d '\n')"   # e.g. rotate AUTH_SECRET
# then: push to main, or Actions → "Build & deploy to VPS" → Run workflow
```

Rotating `AUTH_SECRET` **invalidates existing JWT sessions** (everyone is logged out) — expected;
login still works on the next sign-in. Rotating the consumer key/secret requires the matching
consumer at meta.wikimedia.org.

- **Sessions are stateless JWT** — no Redis, no session table; `AUTH_SECRET` is the only new
  server-secret surface. The OAuth scope is identify-only (no edit/act-on-behalf grant). The
  session `maxAge` is **7 days** (`lib/auth/config.ts`).
- **Moderator role changes** (grant/revoke via `WIKIPLUS_MODERATORS` or the DB `is_moderator`
  flag) take effect in a user's **UI affordances** only after they re-login or their JWT expires
  (`maxAge` 7 days) — the role is stamped on the JWT at sign-in, not re-resolved per read. The
  **write boundary enforces the role server-side immediately regardless**, so a stale claim only
  affects which affordances show, never authorization.
- **`AUTH_URL`** is pinned to `https://wikiplus.wikiedu.org` in the compose file (public, not a
  secret) so the OAuth `redirect_uri` matches the registered consumer callback behind Caddy/Cloudflare.
- To inspect the box `.env` keys (read-only, values redacted), use `scripts/ops/box-secrets-check.sh`
  rather than an interactive SSH.

> **Security trade-off (issue #49):** these three secrets now transit the **ephemeral, encrypted
> GitHub Actions runner** (set in the deploy job's `env:`, forwarded to the SSH step via `envs:`,
> masked in the action log). We accept this for automation — it's a deliberate move away from the
> host-only-secret posture. **`POSTGRES_PASSWORD` does NOT change**: it stays a **file-based Docker
> secret** (`secrets/postgres_password`) plus a box-`.env` value (§3b), created on the box and never
> passed through the runner. Only the three OAuth/Auth runtime secrets ride the deploy job.

### ⚠️ OWNER ACTION — register the prod callback URL (login fails until done)

The Wikimedia OAuth **consumer** must have the production callback/redirect URL registered, or every
login round-trip fails with **`redirect_uri mismatch`**. Auth.js's built-in Wikimedia provider uses the
default callback path:

```
https://wikiplus.wikiedu.org/api/auth/callback/wikimedia
```

Register/confirm it on the consumer's admin page at **meta.wikimedia.org**
(`Special:OAuthConsumerRegistration` / the consumer's manage page). This is the **owner's** action
(consumer admin) — Ops cannot do it. Confirm it is registered **before** the change goes live, or login
ships broken (reading is unaffected — only the auth round-trip 400s).

### Migration on this deploy (issue C — `0001_loose_blockbuster`)

This deploy carries **one** Drizzle migration, `drizzle/0001_loose_blockbuster.sql`:
`ALTER TABLE contributor DROP CONSTRAINT contributor_handle_unique;` — additive and unconditional
(QA-verified it applies cleanly on top of #45 and preserves the seeded `@prototype` stub). It runs
**automatically** via the `migrate` one-shot during `docker compose up -d --wait`, before `app` starts.
No manual step. **Rollback note:** re-adding the constraint later is only blocked by genuine duplicate
handles, of which there are none today; the previous image `:<sha>` tag in GHCR is the fast rollback.

### Session cookie / TLS + a 308 to confirm

- **Cookie `Secure`:** Caddy terminates TLS, so Auth.js sets the session cookie `Secure` automatically
  (HTTPS host). No action — but post-deploy, confirm login persists (the cookie is accepted) through
  Caddy/Cloudflare.
- **MINOR-2 — `trailingSlash:true` + `/api/auth/session` 308:** the next-auth client fetches
  `/api/auth/session` (no trailing slash); with `trailingSlash:true` Next emits a **308** to the
  slashed form, which browsers follow. Confirm Caddy/Cloudflare passes the 308 through cleanly (does not
  strip/mangle it) so `useSession()` resolves and the header shows the logged-in state. If the
  proxy interferes, that is the first thing to check.

## 4. Place the deploy files at `/opt/wikiplus`

The box needs `deploy/docker-compose.yml` (renamed to `docker-compose.yml`) and the `Caddyfile`
(plus, since #45, the `secrets/postgres_password` + `.env` from §3b — those are created on the box,
not copied from the repo). Two options for the committed files:

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

## 5. GHCR pull auth — no manual step needed for a public repo

The image is `ghcr.io/ragesoss/wikiplus`. **In practice (2026-06-16) the box's first
`docker compose pull` succeeded with no auth and no manual visibility change** — GitHub serves
a container package linked to a **public** repo to anonymous pulls. So for this repo: **do
nothing here.** (The earlier worry that the first deploy would fail on a private package — QA
finding "H1" — did not materialize.)

Only if you later make the repo private, or pulls start returning `denied`/`unauthorized`,
log the box in once with a **read-only PAT** (classic PAT with `read:packages`, or a
fine-grained token with package read):

```sh
echo "<GHCR_READ_PAT>" | docker login ghcr.io -u ragesoss --password-stdin
```

(Login persists in `~/.docker/config.json`, so the deploy job's `docker compose pull` then
works without re-auth.)

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
| `YOUTUBE_API_KEY` | The referrer-restricted YouTube Data API key, baked into the client bundle at build time (`--build-arg NEXT_PUBLIC_YOUTUBE_API_KEY`). Unset → live search no-ops. **The key is HTTP-referrer-restricted — the live origin must be on its allowlist (see ⚠️ below) or every search 403s even though the key is present.** *(Carried over from the old Pages workflow.)* |
| `AUTH_SECRET` | Auth.js JWT session signing/encryption (issue #49). **Runtime server secret** — injected into the box `.env` by the deploy job, never into the image/bundle. See §3c. |
| `WIKIMEDIA_OAUTH_CLIENT_KEY` | Wikimedia OAuth consumer key (issue #49). Written to the box `.env` as the lowercase `wikimedia_oauth_client_key` (Actions uppercases secret names — see §3c name mapping). |
| `WIKIMEDIA_OAUTH_CLIENT_SECRET` | Wikimedia OAuth consumer secret (issue #49). Written to the box `.env` as the lowercase `wikimedia_oauth_client_secret`. |

`GITHUB_TOKEN` is the built-in token GitHub injects automatically (used to push to GHCR) —
**do not set it**.

> **Postgres secrets are BOX-side, not GitHub secrets (issue #45).** `POSTGRES_PASSWORD`
> (`/opt/wikiplus/.env`) and the `postgres_password` Docker secret file
> (`/opt/wikiplus/secrets/postgres_password`) live **only on the box** (§3b) — the CI **image build
> never connects to Postgres** (DB access is lazy + runtime-only, so `next build` needs no
> `DATABASE_URL`). There is **no** `DATABASE_URL` or DB password GitHub Actions secret to set; the app
> assembles `DATABASE_URL` at runtime from the box's `.env`. The migrate one-shot runs on the box
> during `docker compose up -d`, not in CI.

> **Auth runtime secrets are GitHub Actions secrets, injected at deploy time (issue #49).**
> `AUTH_SECRET`, `WIKIMEDIA_OAUTH_CLIENT_KEY`, and `WIKIMEDIA_OAUTH_CLIENT_SECRET` are repo Actions
> secrets; the deploy job writes them into `/opt/wikiplus/.env` (as `AUTH_SECRET` +
> the lowercase `wikimedia_oauth_client_*` keys) before `docker compose up -d` — read by the `app`
> container at **runtime** (§3c). They must **never** be baked into the CI image (unlike the
> build-time YouTube key) — they ride the **deploy** job, not the build job; `.dockerignore`
> excludes `.env` so it cannot enter an image layer either. Set/rotate them with `gh secret set`
> (§3c), no SSH. Trade-off: they transit the ephemeral, encrypted runner — accepted for automation,
> whereas `POSTGRES_PASSWORD` (above) stays host-only and never crosses the runner.

> **⚠️ YouTube referrer allowlist (post-deploy, easy to miss):** the `YOUTUBE_API_KEY` is
> **HTTP-referrer-restricted** in Google Cloud Console, so it only works from origins on its
> allowlist. After standing up a new origin, add it or live candidate suggestions fail with
> `API_KEY_HTTP_REFERRER_BLOCKED` even though the key is correctly baked into the bundle.
> Console → **APIs & Services → Credentials →** the key → **Application restrictions → Website
> restrictions**, add `wikiplus.wikiedu.org/*` (keep `localhost`/`127.0.0.1` for local dev).
> Confirmed required on the 2026-06-16 cutover from `ragesoss.github.io`.

```sh
# Run from a checkout (the repo is the default target). DEPLOY_SSH_KEY reads the private key file:
gh secret set DEPLOY_HOST     --body "<BOX_IP>"
gh secret set DEPLOY_USER     --body "<deploy_user>"
gh secret set DEPLOY_SSH_KEY  < ~/.ssh/wikiplus_vps_ed25519
gh secret set YOUTUBE_API_KEY --body "<youtube_data_api_key>"   # if not already set on the repo

# Issue #49 runtime server secrets (the deploy job injects these into the box .env — see §3c):
gh secret set AUTH_SECRET                   --body "$(openssl rand -base64 32 | tr -d '\n')"
gh secret set WIKIMEDIA_OAUTH_CLIENT_KEY    --body "<owner consumer key>"
gh secret set WIKIMEDIA_OAUTH_CLIENT_SECRET --body "<owner consumer secret>"
```

(`gh secret set NAME < file` reads the secret value from the file — the right way to load the
multi-line private key without it touching the shell history.)

## Operational notes

- **Backups:** two stateful volumes now live on the box. **`pgdata`** (issue #45) holds the **shared
  curation data** — back it up with a scheduled `pg_dump`, e.g.
  `docker compose exec -T postgres pg_dump -U wikiplus wikiplus | gzip > /opt/wikiplus/backups/wikiplus-$(date +%F).sql.gz`
  (create `backups/`, add a cron job, prune old dumps). **`caddy_data`** holds the ACME account +
  issued certs; losing it just re-issues certs on next start (rate-limited by Let's Encrypt — fine at
  this volume). Also keep `secrets/postgres_password` + `.env` backed up off-box (losing the password
  with the volume = unreadable data).
- **Logs:** `docker compose logs -f app` / `... caddy`. Caddy access logs are JSON on stdout.
- **GHCR image hygiene:** the deploy job runs `docker image prune -f` after each `up -d` so
  superseded `:<sha>` layers don't accumulate on the small disk.
- **No interactive access in the normal loop:** after this one-time setup, the routine
  prompt → staging loop never SSHes by hand — CI builds and the deploy job pulls + restarts.
