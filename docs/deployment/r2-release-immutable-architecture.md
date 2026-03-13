# R2 Release-Prefixed Immutable Asset Architecture

## Goal

Reduce `/_app/immutable/*` 404s to near-zero by separating immutable frontend assets from pod lifecycle.

Target outcomes:

-   HTML and immutable JS/CSS are always referenced as one release set.
-   Old HTML can continue loading old immutable assets for days after deployment.
-   Pod rollout, autoscaling, restart, and canary/prod separation no longer affect asset availability.
-   Users do not need to see a top-of-page "new version deployed" refresh banner.

## Recommendation

Adopt a hybrid architecture:

1. Keep SSR HTML and API responses on the existing app deployment.
2. Move only `/_app/immutable/*` to Cloudflare R2 behind a custom domain.
3. Publish immutable assets under a release-prefixed path:

```text
https://static.damoang.net/releases/sha-<gitsha>/_app/immutable/...
```

4. Ensure each HTML release references only its own release-prefixed asset URLs.

This matches the common large-service pattern: release-versioned immutable assets on object storage + CDN, dynamic HTML on app servers.

## Why This Fixes the Current Failure Mode

Current failures happen when HTML and the immutable file set are not guaranteed to stay together during rollout.

With release-prefixed assets:

-   old HTML references old release paths
-   new HTML references new release paths
-   both asset sets can coexist safely
-   CDN and browsers can cache immutable files for a long time
-   deployment timing no longer decides whether the referenced file exists

## Target Request Flow

### HTML / SSR

```text
User -> Cloudflare -> angple-web Service -> SvelteKit SSR
```

### Immutable Assets

```text
User -> Cloudflare (static.damoang.net) -> R2 custom domain
```

Example:

```html
<script
    type="module"
    src="https://static.damoang.net/releases/sha-abc123/_app/immutable/bundle.xyz.js"
></script>
```

## Naming Rules

### Release ID

Use the same immutable identifier already used for deployment:

```text
sha-<gitsha>
```

### R2 Object Layout

```text
releases/
  sha-abc123/
    _app/
      immutable/
        bundle.xyz.js
        bundle.xyz.js.gz
        bundle.xyz.js.br
        assets/...
```

### Domain Layout

```text
https://static.damoang.net/releases/sha-abc123/_app/immutable/...
```

## Deployment Model

### Build

GitHub Actions should:

1. Build the SvelteKit app.
2. Build the container image tagged with `sha-<gitsha>`.
3. Upload `apps/web/build/client/_app/immutable/` to R2 under `releases/<sha>/`.
4. Deploy app pods with the same release SHA.

### Runtime

The app deployment should expose the active release ID to SSR.

Recommended environment variable:

```text
ASSET_RELEASE_ID=sha-<gitsha>
ASSET_BASE_URL=https://static.damoang.net/releases/sha-<gitsha>
```

SSR should build immutable asset URLs from `ASSET_BASE_URL`.

## Required App Changes

### 1. Asset URL Rewriting

SvelteKit-generated immutable URLs currently assume same-origin `/_app/immutable/...`.

We need one of these approaches:

1. preferred: configure generated asset base URL so build output already points to `https://static.damoang.net/releases/<sha>/`
2. fallback: rewrite immutable asset URLs in SSR HTML before response

Preferred behavior:

-   local/dev: same-origin
-   production: release-prefixed static domain

### 2. Remove Runtime Immutable Copy Dependence

Once R2 serves immutable assets, app pods no longer need to copy immutable files into `emptyDir` for public delivery.

That means the long-term target is:

-   remove `copy-immutable-assets` initContainer
-   remove `immutable-assets` emptyDir
-   remove nginx alias dependency for public `/_app/immutable/*`

Short term, these can stay while the static domain migration is introduced.

### 3. Keep Error Recovery, But Stop User Banner UX

Client behavior should remain:

-   one silent forced reload on chunk exhaustion
-   no top update banner

This is already aligned with the recent frontend changes.

## Cloudflare / R2 Rules

### Cache Rules

For `static.damoang.net/releases/*/_app/immutable/*`:

-   `200`: cache long, immutable
-   `404`: do not cache

For HTML on `damoang.net`:

-   short cache or bypass
-   targeted purge on deployment if needed

### Security / Access

Use an R2 custom domain, not `r2.dev`, for production delivery.

## Retention Policy

Keep previous release asset sets for at least 7 days.

Recommended progression:

-   phase 1: 7 days
-   phase 2: 14 days
-   phase 3: 30 days if storage cost remains acceptable

Delete only whole release prefixes, never individual files from an active release.

## Rollback Model

Rollback becomes simple:

1. redeploy app pods with previous `sha-<gitsha>`
2. HTML again points to previous release prefix
3. old immutable assets already exist in R2

No asset recopy or shared-volume repair is needed.

## Canary / Production Model

Both canary and production can use the same immutable asset upload model.

Recommended rule:

-   canary HTML references canary release SHA paths
-   production HTML references production release SHA paths

Do not use mutable `latest` tags anywhere in deploy or storage naming.

## Monitoring and Auto-Recovery

Keep the current health-check strategy and adapt it to the static domain:

1. fetch production HTML
2. extract referenced immutable bundle URL
3. verify bundle returns `200`
4. if external returns `404` but origin HTML is healthy:
    - targeted purge the HTML page and the broken immutable URL
    - alert Telegram

Once migrated, this check should validate `static.damoang.net/...` instead of same-origin `/_app/immutable/...`.

## Migration Plan

### Phase 0: Already in Progress

-   SHA-pinned deployment
-   top update banner removed
-   immutable 404 detection and targeted purge support

### Phase 1: Introduce Static Domain Without Removing Existing Delivery

1. Create R2 bucket for immutable assets.
2. Attach `static.damoang.net` custom domain.
3. Upload each release's immutable assets to `releases/<sha>/`.
4. Add app config for:
    - `ASSET_BASE_URL`
    - `ASSET_RELEASE_ID`
5. Update SSR/build output so immutable URLs point to the static domain.
6. Validate production HTML references `static.damoang.net/releases/<sha>/...`.

### Phase 2: Dual Safety Window

For a limited time:

-   keep existing pod-local immutable serving available
-   serve new HTML with static-domain immutable URLs

This reduces migration risk.

### Phase 3: Remove Pod-Local Immutable Delivery

After stable verification:

-   remove initContainer copy
-   remove public immutable serving from nginx sidecar
-   simplify `angple-web` deployment

## Concrete Repo Changes Expected Next

### GitHub Actions

-   upload immutable assets to R2 after build
-   pass release SHA into deploy

### Web App

-   production asset base URL configuration
-   SSR or build-time immutable URL rewrite

### Kubernetes

-   add env vars for active release and static asset base
-   later remove immutable copy container and volume

### Health Check

-   switch bundle validation target to `static.damoang.net`

## Success Criteria

The migration is successful when all of the following are true:

1. production HTML references only `static.damoang.net/releases/<sha>/...`
2. referenced immutable bundle returns `200`
3. canary/prod rollout no longer changes public immutable file availability
4. users no longer report white screen after deploy
5. immutable 404 alerts become rare or zero
