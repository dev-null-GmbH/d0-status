# d0 public status

Static status frontend and bounded, anonymous public endpoint checks. The site
and its scheduler run outside FRA1: GitHub Pages and GitHub-hosted runners.
There are no runtime packages, customer credentials, or private network access.

`bun install --frozen-lockfile` installs the pinned browser test tooling.
`bun test` verifies contract matching, environment separation, bounded response
reads, incident validation, and safe rendering. `bun run build.ts --fixture`
builds an offline preview in `dist/` with deliberately unverified observations.
`bun run test:browser` checks Chromium at 375 and 1280 pixels, keyboard access,
and stale observation behavior (install Chromium with `bunx playwright install chromium`).
`bun run build.ts` performs ten public GETs, each with a five-second deadline and
a 64 KiB metadata limit. It performs no customer operation or load test.

The public contracts checked are the customer console's process health, the
canonical identity discovery contract, and each product/environment's OAuth
resource metadata. No customer action, database integrity, native resource,
payment, or tax transmission is inferred from them. Failed observations are
not automatically described as confirmed incidents. Observations expire after
fifteen minutes, including when the scheduler or publication fails.

## Independent publication

The organization currently uses GitHub Free (verified 2026-10-15); Pages cannot
be enabled for the private application repository on that plan. This dedicated
source contains only public status information and is published in the separate
**public** [`dev-null-GmbH/d0-status`](https://github.com/dev-null-GmbH/d0-status) repository. Do not change an application
repository's visibility or copy private application source into it.

The reviewed public source uses `main` as the default branch. Pages uses
**GitHub Actions** as the build source, and the `github-pages` environment allows
only `main`. The workflow
publishes only `dist/`, using its job-scoped Pages/OIDC permissions. It has no
personal token, source-write access, or infrastructure credential. PRs build
offline fixtures and cannot publish. Failed probes still publish their failed
observations; failed builds leave the previous publication to become stale.

The verified provider URL is [dev-null-gmbh.github.io/d0-status](https://dev-null-gmbh.github.io/d0-status/)
and remains usable independently of d0 DNS. Publication run
[38725541259](https://github.com/dev-null-GmbH/d0-status/actions/runs/38725541259)
succeeded on 2026-10-15; anonymous HTTP and browser checks confirmed the page,
relative script/style assets, no horizontal overflow, and no browser errors.
Configure
`status.d0.eu` as a verified custom domain in Pages and its public DNS only after
the independent provider URL is verified. The custom DNS record and Pages
custom-domain binding have not yet been configured.

## Incident updates

Operators update `incidents.json` through the repository review process. Each
incident contains exactly `id`, `title`, `message`, `components`, `status`,
`started_at`, and `updated_at`. Component IDs are defined in `status.ts`. Status
is `investigating`, `identified`, `monitoring`, or `resolved`; retain resolved
entries for history. All text must be safe for public disclosure. Never include
customer names, request bodies, private hostnames, tokens, or internal logs.
An approved push publishes immediately; scheduled observation runs preserve
the same incident source.

The scheduled interval is ten minutes, not an uptime guarantee. GitHub can
delay or drop scheduled runs; the visible age check then marks status unknown.

Toolchain qualification on 2026-10-15: Bun 1.4.3 and checkout/setup-bun match
the qualified web toolchain. Playwright 1.64.1 was verified against its official
release and matches the existing web browser suite. The official `actions/upload-pages-artifact`
v5.0.0 and `actions/deploy-pages` v5.0.1 release tags resolve to the full commit
pins in the workflow.

Primary references: [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages),
[scheduled workflow limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule),
[Pages deployment action](https://github.com/actions/deploy-pages), and
[Pages artifact action](https://github.com/actions/upload-pages-artifact).
