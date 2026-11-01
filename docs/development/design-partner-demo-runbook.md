# Resurgo design-partner demonstration runbook

This demonstration runs Resurgo, PostgreSQL, Garage, ClamAV, Mailpit, and the
document worker on the local workstation. Only the Next.js origin is reachable
through Cloudflare Tunnel. Every person, organization, fact, and document in
the demonstration is fictional.

## Fixed demonstration boundary

- Public origin: `https://demo.5o5.sh`
- Named tunnel: `resurgo-demo`
- Local origin: `http://127.0.0.1:3000`
- Cloud hosting: none
- Connector: pinned local `cloudflared` 2026.10.7
- Private services: PostgreSQL, Garage, ClamAV, Mailpit, and document worker

Never share the hostname until the Access policy below is active.

## One-time local preparation

```bash
pnpm setup:local
pnpm db:migrate
pnpm demo:seed
pnpm demo:external:init
```

`pnpm demo:reset` is scoped to the known fictional identities, case graph,
organizations, and exact document keys. It refuses production and non-loopback
databases and does not drop schemas or delete unrelated development cases.

The generated demo credentials and external Better Auth secret are stored
under ignored `.secrets/` with mode `0600`. Retrieve demo credentials locally:

```bash
cat .secrets/demo-credentials.json
pnpm demo:code client
pnpm demo:code attorney
pnpm demo:code lender
```

Never copy passwords, TOTP setup secrets, recovery codes, or tunnel tokens into
GitHub, chat, screenshots, or the runbook.

## Cloudflare owner actions

1. Open **Cloudflare Zero Trust → Networks → Tunnels**.
2. Create a Cloudflared tunnel named `resurgo-demo`.
3. Add a public hostname:
   - Subdomain: `demo`
   - Domain: `5o5.sh`
   - Type: `HTTP`
   - URL: `http://localhost:3000`
4. Copy only the connector token from the generated Linux connector command.
   Store it without echoing it or placing it in shell history:

   ```bash
   mkdir -p .secrets
   chmod 700 .secrets
   umask 077
   read -rsp "Cloudflare tunnel token: " RESURGO_TUNNEL_TOKEN
   printf '%s' "$RESURGO_TUNNEL_TOKEN" > .secrets/cloudflared-token
   unset RESURGO_TUNNEL_TOKEN
   chmod 600 .secrets/cloudflared-token
   ```

5. Before starting the connector, open **Zero Trust → Access → Applications**
   and add a **Self-hosted** application for `demo.5o5.sh`.
6. Create one Allow policy whose Include rule lists only the owner's exact email
   and the invited reviewer's exact email. Use an email one-time PIN or another
   owner-approved identity provider. Do not include `Everyone`, an email domain,
   a Bypass rule, or a Service Auth rule.
7. Set a short demonstration session duration (eight hours or less), save the
   policy, and confirm it is attached to the application.

The tunnel token authorizes the connector; it does not restrict visitors.
Cloudflare Access must be configured before the URL is shared.

## Start and stop

Stop any manually started server on port 3000, then run:

```bash
pnpm demo:external:start
```

This command validates private file permissions, starts the private Compose
services, applies migrations, builds Next.js with
`NEXT_PUBLIC_APP_URL=https://demo.5o5.sh`, starts the production server on
loopback, and starts the named-tunnel connector. Logs and PIDs remain under
ignored `.secrets/demo-runtime/`.

Stop the tunnel, web server, and private services while preserving volumes:

```bash
pnpm demo:external:stop
```

## External verification

First open `https://demo.5o5.sh` in a fresh private browser. A non-allowlisted
address must not reach Resurgo. Then authenticate with an allowlisted address.
Save only the Access browser state locally for the automated smoke test:

```bash
pnpm exec playwright codegen \
  --save-storage=.secrets/cloudflare-access-state.json \
  https://demo.5o5.sh
```

After completing the Access prompt, close the browser and run:

```bash
RESURGO_EXTERNAL_BASE_URL=https://demo.5o5.sh \
RESURGO_CF_ACCESS_STORAGE_STATE=.secrets/cloudflare-access-state.json \
pnpm exec playwright test --config playwright.external.config.ts
```

The test uses a fresh unauthorized context first, then the approved Access
state to verify lender MFA, the review register, an authorized PDF preview,
logout, and protected-route denial.

## Recommended ten-minute walkthrough

1. Sign in as fictional mortgage specialist **Whitney Owings** and complete MFA.
2. Open the populated Fulton County case and the Professional Review Register.
3. Explain the proposed 90-day refinance deadline and $62,500 equity buyout.
4. Open only the mortgage documents explicitly disclosed to the specialist.
5. Show unresolved income, credit, debt-ratio, appraisal, buyout-funds, and
   closing-assurance conditions. Clarify that this is not underwriting approval.
6. Switch to fictional attorney **Morgan Reed**. Show the permitted findings
   and acknowledgement without exposing the restricted mortgage statement.
7. Switch to fictional client **Jordan Ellis**. Show the immutable evidence,
   outstanding conditions, roadmap, and Professional Review Register.
8. Demonstrate that revoked property access and cross-domain document requests
   return denial rather than leaking resource existence.

## Authentication troubleshooting

- Generate a current code with `pnpm demo:code lender` (or `client`/`attorney`).
- TOTP codes rotate every 30 seconds; retry with a fresh code near a boundary.
- A Cloudflare Access challenge occurs before Resurgo authentication.
- External mode deliberately disables self-registration. Use seeded accounts.
- Do not expose Mailpit; it remains a loopback-only development service.
- Inspect `.secrets/demo-runtime/web.log` and `cloudflared.log` locally. Never
  paste logs externally without checking that they contain no sensitive data.

## Security limitations

This is a workstation-hosted design-partner demonstration, not a production
deployment or a claim of legal, mortgage, GLBA, HIPAA, RESPA, or other
regulatory compliance. Availability depends on the workstation and connector.
The owner must remove the reviewer from Access and stop the tunnel when the
review window closes.
