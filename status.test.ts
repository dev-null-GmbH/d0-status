import { describe, expect, test } from "bun:test";
import {
  observe,
  render,
  targets,
  validateIncidents,
  type Snapshot,
} from "./status";

describe("public probes", () => {
  test("only exact identity contracts count; redirects and credentials are never used", async () => {
    for (const target of targets) {
      const fetcher = (async (url: string, init: RequestInit) => {
        expect(url).toBe(target.url);
        expect(init.redirect).toBe("error");
        expect(init.signal).toBeInstanceOf(AbortSignal);
        expect(new Headers(init.headers).get("Authorization")).toBeNull();
        return target.expectedStatus === 204
          ? new Response(null, { status: 204 })
          : Response.json(
              "resource" in target
                ? {
                    resource: target.resource,
                    authorization_servers: ["https://auth.d0.eu"],
                  }
                : {
                    issuer: "https://auth.d0.eu",
                    jwks_uri: "https://auth.d0.eu/oauth2/jwks",
                  },
            );
      }) as typeof fetch;
      expect((await observe(target, fetcher)).result).toBe("responding");
    }
  });
  test("cross-environment metadata, oversized or malformed responses, and failures stay unverified", async () => {
    const target = targets.find((value) => value.id === "accounting-test")!;
    for (const response of [
      Response.json({
        resource: "https://api.d0.eu/accounting",
        authorization_servers: ["https://auth.d0.eu"],
      }),
      Response.json({
        resource: "https://api.test.d0.eu/accounting",
        authorization_servers: ["https://attacker.invalid"],
      }),
      new Response("{}", { headers: { "content-type": "text/html" } }),
      new Response("{", { headers: { "content-type": "application/json" } }),
      Response.json({ data: "a".repeat(65537) }),
      new Response(null, { status: 302 }),
      new Response(null, { status: 503 }),
    ])
      expect(
        (await observe(target, (async () => response) as typeof fetch)).result,
      ).toBe("check_failed");
    expect(
      (
        await observe(target, (async () => {
          throw new Error("private response must not appear");
        }) as typeof fetch)
      ).reason,
    ).toBe("unreachable");
  });
});

test("incident publication validates its scope and renders operator text as text", () => {
  const incidents = [
    {
      id: "fixture",
      title: "<script>probe</script>",
      message: "Synthetic incident & evidence",
      components: ["console"],
      status: "monitoring",
      started_at: "2026-10-15T10:00:00Z",
      updated_at: "2026-10-15T10:01:00Z",
    },
  ];
  const snapshot: Snapshot = {
    schema: "d0.public-status.v1",
    observed_at: "2026-10-15T10:01:00Z",
    expires_at: "2026-10-15T10:16:00Z",
    observations: [],
    incidents: validateIncidents(incidents),
  };
  expect(render(snapshot)).toContain("&lt;script&gt;probe&lt;/script&gt;");
  expect(render(snapshot)).not.toContain("<script>probe</script>");
  for (const invalid of [
    null,
    [...incidents, ...incidents],
    [{ ...incidents[0], components: ["unknown"] }],
    [{ ...incidents[0], status: "operational" }],
    [{ ...incidents[0], updated_at: "2026-10-14T10:01:00Z" }],
    [{ ...incidents[0], privateData: "not public" }],
  ]) {
    expect(() => validateIncidents(invalid)).toThrow();
  }
});
