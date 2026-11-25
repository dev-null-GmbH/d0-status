# d0 public status

Independent, static public status for d0. This repository may contain only
public endpoint configuration, synthetic tests, status presentation, and
operator-approved incident descriptions. Never add credentials, private
infrastructure addresses, customer identifiers, or customer payloads.

- Bun 1.4.5; no runtime dependencies. Keep action commits pinned.
- A failed public probe is an observation, not a confirmed service incident.
- Stale or missing observations are unknown, never operational.
- Do not derive uptime percentages or availability promises from these probes.
- Preserve independent hosting: GitHub-hosted runners and GitHub Pages, not FRA1.
- Verify with `bun test`, `bun run build.ts --fixture`, and `bun run test:browser`.
- A push to `main` can publish a change to the site, including incident changes.
  Pull requests and pushes limited to recognized policy or test-tool files run
  fixture checks. Scheduled observations still publish.
