import { mkdir, copyFile } from "node:fs/promises";
import {
  observe,
  render,
  targets,
  validateIncidents,
  type Snapshot,
} from "./status";

const now = new Date();
const fixture = process.argv.includes("--fixture");
const incidents = validateIncidents(
  await Bun.file(new URL("./incidents.json", import.meta.url)).json(),
);
const snapshot: Snapshot = {
  schema: "d0.public-status.v1",
  observed_at: now.toISOString(),
  expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
  incidents,
  observations: await Promise.all(
    targets.map((target) =>
      fixture
        ? {
            id: target.id,
            title: target.title,
            environment: target.environment,
            url: target.url,
            observed_at: now.toISOString(),
            result: "check_failed" as const,
            reason: "unreachable" as const,
          }
        : observe(target, fetch, now),
    ),
  ),
};
await mkdir("dist", { recursive: true });
await Bun.write("dist/index.html", render(snapshot));
await Bun.write("dist/status.json", JSON.stringify(snapshot, null, 2) + "\n");
await Bun.write("dist/.nojekyll", "");
for (const file of ["status.js", "status.css"])
  await copyFile(file, `dist/${file}`);
console.log(
  `Built ${snapshot.observations.length} public observations${fixture ? " (offline fixture, no live claims)" : ""}.`,
);
