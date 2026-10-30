# Synthetic design-partner demo

The demo scenario is entirely fictional. It shows Jordan Ellis coordinating a
Fulton County divorce-related mortgage transition with fictional attorney
Morgan Reed and fictional mortgage specialist Taylor Brooks. The fictional
organizations are explicitly labeled as demo practices; Centurion is not used.

## Local preparation

```bash
pnpm setup:local
pnpm db:migrate
pnpm demo:seed
pnpm build
NODE_ENV=production pnpm start
```

Open `http://127.0.0.1:3000`. Generated account credentials and TOTP setup
material are written to `.secrets/demo-credentials.json` with mode `0600` and
are ignored by Git. Do not paste that file into tickets or commit it. Print a
current one-time code without exposing the stored setup secret:

```bash
pnpm demo:code client
pnpm demo:code attorney
pnpm demo:code lender
```

`pnpm demo:seed` is idempotent. To rebuild the demonstration from an empty
local database, run `pnpm demo:reset`. This guarded command refuses production
or non-loopback database hosts and deletes all data in the local Resurgo
database schemas before migrating and reseeding.

## Private Cloudflare Tunnel (requires owner configuration)

1. Install `cloudflared` from Cloudflare's official distribution.
2. Authenticate to the owned Cloudflare account: `cloudflared tunnel login`.
3. Create a named tunnel: `cloudflared tunnel create resurgo-demo`.
4. Copy `infra/cloudflare/config.example.yml` to
   `~/.cloudflared/config.yml`, then fill in the tunnel UUID, credentials path,
   and an owned HTTPS hostname.
5. Route DNS: `cloudflared tunnel route dns resurgo-demo <hostname>`.
6. In Cloudflare Zero Trust, create an Access self-hosted application for the
   exact hostname and an Allow policy containing only the invited reviewer
   email addresses. Do not create a bypass policy.
7. Build and start Resurgo with `NODE_ENV=production`,
   `NEXT_PUBLIC_APP_URL=https://<hostname>`, a fresh production-strength
   `BETTER_AUTH_SECRET`, and the existing private local service endpoints.
   This makes Better Auth trust only the public HTTPS origin and issue secure
   session cookies.
8. Start: `cloudflared tunnel --config ~/.cloudflared/config.yml run resurgo-demo`.
9. Stop the foreground tunnel with `Ctrl+C`. Stop Resurgo with the normal
   process supervisor or terminal signal; local infrastructure remains private.

Cloudflare credentials, an owned domain/hostname, and the reviewer email
allowlist are intentionally not stored in this repository. External access is
not verified until the Access challenge and Resurgo sign-in are both exercised
from an external browser.
