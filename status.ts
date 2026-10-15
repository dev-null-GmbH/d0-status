export type Observation = {
  id: string;
  title: string;
  environment: "production" | "test";
  url: string;
  observed_at: string;
  result: "responding" | "check_failed";
  reason: "verified" | "unexpected_status" | "invalid_metadata" | "unreachable";
};
export type Incident = {
  id: string;
  title: string;
  message: string;
  components: string[];
  status: "investigating" | "identified" | "monitoring" | "resolved";
  started_at: string;
  updated_at: string;
};
export type Snapshot = {
  schema: "d0.public-status.v1";
  observed_at: string;
  expires_at: string;
  observations: Observation[];
  incidents: Incident[];
};

const products = ["platform", "accounting", "einvoice", "eric"] as const;
export const targets = [
  {
    id: "console",
    title: "Customer console",
    environment: "production" as const,
    url: "https://d0.eu/health/live",
    expectedStatus: 204,
  },
  {
    id: "identity",
    title: "Identity",
    environment: "production" as const,
    url: "https://auth.d0.eu/.well-known/openid-configuration",
    expectedStatus: 200,
  },
  ...(["production", "test"] as const).flatMap((environment) =>
    products.map((product) => {
      const origin =
        environment === "test" ? "https://api.test.d0.eu" : "https://api.d0.eu";
      return {
        id: `${product}-${environment}`,
        title:
          product === "einvoice"
            ? "E-Invoice"
            : product === "eric"
              ? "ERiC"
              : product[0].toUpperCase() + product.slice(1),
        environment,
        url: `${origin}/.well-known/oauth-protected-resource/${product}`,
        expectedStatus: 200,
        resource: `${origin}/${product}`,
      };
    }),
  ),
];

async function boundedJSON(response: Response): Promise<unknown> {
  if (
    response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    throw new Error("content type");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("missing body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 65536) throw new Error("oversized metadata");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel();
  }
}

export async function observe(
  target: (typeof targets)[number],
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<Observation> {
  const result: Observation = {
    id: target.id,
    title: target.title,
    environment: target.environment,
    url: target.url,
    observed_at: now.toISOString(),
    result: "check_failed",
    reason: "unreachable",
  };
  try {
    const response = await fetcher(target.url, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: "application/json",
        "User-Agent": "d0-public-status/1.0",
      },
    });
    if (response.status !== target.expectedStatus) {
      await response.body?.cancel();
      return { ...result, reason: "unexpected_status" };
    }
    if (target.expectedStatus === 200) {
      result.reason = "invalid_metadata";
      const body = await boundedJSON(response);
      if (!body || typeof body !== "object" || Array.isArray(body))
        return result;
      const value = body as Record<string, unknown>;
      if ("resource" in target) {
        if (
          value.resource !== target.resource ||
          !Array.isArray(value.authorization_servers) ||
          value.authorization_servers.length !== 1 ||
          value.authorization_servers[0] !== "https://auth.d0.eu"
        )
          return result;
      } else if (
        value.issuer !== "https://auth.d0.eu" ||
        value.jwks_uri !== "https://auth.d0.eu/oauth2/jwks"
      ) {
        return result;
      }
    }
    return { ...result, result: "responding", reason: "verified" };
  } catch {
    return result;
  }
}

export function validateIncidents(input: unknown): Incident[] {
  if (!Array.isArray(input) || input.length > 1000)
    throw new Error("invalid incident collection");
  const ids = new Set<string>();
  const components = new Set(targets.map((target) => target.id));
  const fields = [
    "id",
    "title",
    "message",
    "components",
    "status",
    "started_at",
    "updated_at",
  ].sort();
  for (const item of input) {
    if (
      !item ||
      typeof item !== "object" ||
      JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(fields) ||
      typeof item.id !== "string" ||
      !/^[a-z0-9-]{1,80}$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.title !== "string" ||
      item.title.length < 1 ||
      item.title.length > 160 ||
      typeof item.message !== "string" ||
      item.message.length < 1 ||
      item.message.length > 4000 ||
      !["investigating", "identified", "monitoring", "resolved"].includes(
        item.status,
      ) ||
      !Array.isArray(item.components) ||
      !item.components.length ||
      item.components.some(
        (id: unknown) => typeof id !== "string" || !components.has(id),
      ) ||
      typeof item.started_at !== "string" ||
      typeof item.updated_at !== "string" ||
      !Number.isFinite(Date.parse(item.started_at)) ||
      !Number.isFinite(Date.parse(item.updated_at)) ||
      Date.parse(item.updated_at) < Date.parse(item.started_at)
    )
      throw new Error("invalid incident");
    ids.add(item.id);
  }
  return input as Incident[];
}

export const escapeHTML = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export function render(snapshot: Snapshot): string {
  const e = escapeHTML;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer"><title>d0 · Service status</title><link rel="stylesheet" href="./status.css"><script src="./status.js" defer></script></head>
<body><a class="skip" href="#main">Skip to service status</a><header><a href="https://d0.eu" class="brand">/dev/null <span>d0</span></a><span>Public status</span></header>
<main id="main" data-observed="${e(snapshot.observed_at)}" data-expires="${e(snapshot.expires_at)}"><p class="eyebrow">SERVICE STATUS</p><h1>Service status.</h1>
<p class="intro">Latest endpoint checks and confirmed incidents across d0.</p>
<div id="freshness" class="notice" role="status">Checking the age of these observations. The recorded results below describe the last check, not a current availability guarantee.</div>
<p class="timestamp">Last observation: <time datetime="${e(snapshot.observed_at)}">${e(snapshot.observed_at)}</time> · <a href="./status.json">Download status JSON</a></p>
${(["production", "test"] as const)
  .map(
    (environment) =>
      `<section aria-labelledby="${environment}-heading"><h2 id="${environment}-heading">${environment === "production" ? "Production" : "Isolated test environments"}</h2><div class="grid">${snapshot.observations
        .filter((item) => item.environment === environment)
        .map(
          (item) =>
            `<article><div class="card-heading"><h3>${e(item.title)}</h3><span class="badge ${item.result}" data-result="${item.result}">Last check: ${item.result === "responding" ? "responding" : "not verified"}</span></div><p>${item.id === "console" ? "Public web process check." : "Public identity metadata check."}</p><a class="endpoint" href="${e(item.url)}">View checked endpoint <span aria-hidden="true">↗</span></a></article>`,
        )
        .join("")}</div></section>`,
  )
  .join("")}
<section aria-labelledby="incidents-heading"><h2 id="incidents-heading">Confirmed incidents</h2>${snapshot.incidents.length ? snapshot.incidents.map((item) => `<article class="incident"><div class="card-heading"><h3>${e(item.title)}</h3><span class="badge">${e(item.status)}</span></div><p>${e(item.message)}</p><p class="timestamp">${e(item.components.join(", "))} · Updated <time datetime="${e(item.updated_at)}">${e(item.updated_at)}</time></p></article>`).join("") : `<p>No confirmed incidents were recorded in this publication. This does not establish that every service is available.</p>`}</section>
<section class="scope" aria-labelledby="scope-heading"><h2 id="scope-heading">What these checks cover</h2><p>A responding endpoint confirms its public HTTP contract at the recorded time. It does not prove a customer action, payment, tax submission, document validation, or customer resource is available. A failed check is an observation; confirmed incidents are published separately.</p><p>S3 buckets and Kubernetes clusters have customer-specific endpoints. Check their resource state in the <a href="https://d0.eu/developers">customer console</a>. Product capabilities and activation requirements remain in the <a href="https://d0.eu/docs">API documentation</a>.</p><p>Checks are scheduled every ten minutes. Delayed or missing checks become unknown after fifteen minutes. Scheduling and hosting can fail independently; timestamps remain visible. No uptime percentage or high-availability promise is inferred.</p></section></main><footer>/dev/null GmbH · No customer data or credentials are used by these public checks.</footer></body></html>`;
}
