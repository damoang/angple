# R2 Release-Prefixed Immutable Asset Implementation Plan

## Scope

This plan turns the target architecture into an incremental implementation sequence for the current Angple web stack.

Goals:

-   move `/_app/immutable/*` delivery to `static.damoang.net`
-   version immutable assets by release SHA
-   keep SSR HTML/API on the existing app deployment
-   preserve safe rollback and canary flow

## Current Constraints

Observed in the current repo and runtime:

1. frontend builds are produced in `apps/web/build`
2. deploy image is built from `apps/web/deploy`
3. deploy workflow already emits `sha-<gitsha>` tags
4. current runtime still assumes same-origin `/_app/immutable/*`
5. health checks already know how to extract the referenced bundle from HTML

This means the migration does not need a new release identifier format. It only needs:

-   a static asset publishing step
-   a way for HTML to reference the static domain
-   post-deploy validation against the static domain

## Proposed Release Variables

Add these production environment variables:

```text
ASSET_RELEASE_ID=sha-<gitsha>
PUBLIC_ASSET_BASE_URL=https://static.damoang.net/releases/sha-<gitsha>
```

Recommended behavior:

-   local/dev: `PUBLIC_ASSET_BASE_URL` unset
-   production/canary: `PUBLIC_ASSET_BASE_URL` set per release

## Implementation Strategy

Use a 3-step migration.

### Step 1: Publish Assets to R2

Add a workflow step after `pnpm --filter web build`:

1. collect `apps/web/build/client/_app/immutable/`
2. upload to:

```text
releases/${SHA_TAG}/_app/immutable/
```

3. keep brotli and gzip artifacts

Expected upload set:

```text
bundle.*.js
bundle.*.js.br
bundle.*.js.gz
assets/*
entry/*
nodes/*
chunks/*
```

### Step 2: Make HTML Reference Static Asset Base

The current app still emits same-origin immutable paths.

Implementation options:

1. build-time asset base using SvelteKit config
2. SSR HTML rewrite using `transformPageChunk`

Recommended first implementation:

-   use server-side HTML rewrite in `hooks.server.ts`
-   replace only same-origin immutable references in HTML:

```text
/_app/immutable/... -> ${PUBLIC_ASSET_BASE_URL}/_app/immutable/...
```

Why start here:

-   lowest migration risk
-   no need to deeply change build assumptions first
-   easy to guard with `if (PUBLIC_ASSET_BASE_URL)`

Rewrite targets:

-   `<script src="/_app/immutable/...">`
-   `<link href="/_app/immutable/...">`
-   `modulepreload` tags in rendered head

Do not rewrite:

-   API paths
-   non-immutable static paths
-   local/dev requests

### Step 3: Switch Monitoring and Deployment Validation

After HTML rewrite is enabled:

1. health checks should validate bundle URLs on `static.damoang.net`
2. deploy smoke test should:
    - fetch production HTML
    - extract referenced bundle URL
    - assert `200`

This step makes deployment fail fast before users encounter a broken release.

## Detailed Repo Changes

### A. GitHub Actions: `web/.github/workflows/deploy.yml`

Add:

1. R2 credentials configuration
2. upload step for immutable assets
3. deploy-time env propagation of:
    - `ASSET_RELEASE_ID`
    - `PUBLIC_ASSET_BASE_URL`

Suggested secret/env names:

```text
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
STATIC_ASSET_BASE_URL=https://static.damoang.net/releases
```

Expected per-release asset URL:

```text
${STATIC_ASSET_BASE_URL}/${SHA_TAG}
```

### B. Web App: `apps/web/src/hooks.server.ts`

Add a small HTML transform only in production when `PUBLIC_ASSET_BASE_URL` is set.

Pseudo-behavior:

1. call existing `resolve(event, { transformPageChunk })`
2. inside transform:
    - rewrite `"/_app/immutable/..."`
    - rewrite `'/_app/immutable/...'`
3. leave HTML untouched if env var is absent

Important:

-   only rewrite exact immutable path prefixes
-   preserve quotes and relative markup structure

### C. Runtime Config

Inject per-release env values into the deployed web container:

```text
ASSET_RELEASE_ID=sha-abc123
PUBLIC_ASSET_BASE_URL=https://static.damoang.net/releases/sha-abc123
```

Canary and production must each receive their own release value.

### D. Health Check

Update the existing auto-heal/health-check logic later to:

-   accept `static.damoang.net` bundle URLs directly
-   targeted purge those URLs if HTML points to a cached 404

### E. Deploy Smoke Test

Update `k8s/prod/deploy.sh`:

1. fetch HTML from canary/prod
2. extract first immutable JS URL
3. if the extracted URL is relative, prefix with host
4. if absolute, test as-is

This keeps the test compatible across migration phases.

## Cloudflare / R2 Setup Tasks

Required one-time tasks outside the repo:

1. create R2 bucket for immutable assets
2. attach custom domain `static.damoang.net`
3. set cache rule:
    - `200`: long cache
    - `404`: do not cache
4. confirm `br` and `gz` objects are served with correct content headers

## Retention and Cleanup

Do not delete files by age at the object level.

Delete by whole release prefix only:

```text
releases/sha-old-1/
releases/sha-old-2/
```

Recommended cleanup policy:

-   keep latest 20 releases, or
-   keep releases newer than 14 days

Prefer keeping both:

-   minimum 14 days
-   always keep last 20 releases

## Rollback Procedure

Rollback should become:

1. select previous release SHA
2. deploy app pods with that SHA
3. set `PUBLIC_ASSET_BASE_URL` to that SHA path
4. rollout

No asset copy is needed because R2 already holds the previous immutable set.

## Canary Procedure

Canary remains useful.

Canary sequence:

1. upload `sha-x` immutable assets to R2
2. deploy canary with:
    - `ASSET_RELEASE_ID=sha-x`
    - `PUBLIC_ASSET_BASE_URL=https://static.damoang.net/releases/sha-x`
3. validate canary HTML and bundle URL
4. promote the same SHA to production

## Success Gates

Before removing pod-local immutable delivery, confirm:

1. production HTML references `static.damoang.net/releases/<sha>/...`
2. bundle URL returns `200`
3. gzip/brotli responses are correct
4. rollback to a previous SHA works without missing asset errors
5. 404 alerts for immutable assets stay near zero across several deployments

## Recommended Build Order

Implement in this exact order:

1. add R2 upload in GitHub Actions
2. add env-driven HTML rewrite in `hooks.server.ts`
3. add deploy env propagation for release asset base URL
4. update smoke tests for absolute bundle URLs
5. verify canary
6. verify production
7. only then consider removing pod-local immutable serving

## Next Patch Set

The next code patch should include:

1. `web/.github/workflows/deploy.yml`
    - R2 upload step
    - deploy env propagation
2. `web/apps/web/src/hooks.server.ts`
    - immutable asset URL rewrite
3. `k8s/prod/deploy.sh`
    - smoke test support for absolute bundle URLs

After that lands, we can run canary with real release-prefixed static asset URLs.
