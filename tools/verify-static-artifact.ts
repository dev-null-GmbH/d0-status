import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const [directory, role, source] = process.argv.slice(2);
assert(directory && ["fixture", "publication", "observed"].includes(role));
if (role !== "observed") assert.match(source, /^[0-9a-f]{40}$/);

const served = ["index.html", "status.css", "status.js", "status.json"];
const expected = role === "observed" ? served : [".nojekyll", ...served];
const files = await readdir(directory, { withFileTypes: true });
assert(files.every((entry) => entry.isFile()));
assert.deepEqual(files.map(({ name }) => name).sort(), expected);

const read = (name: string) => Bun.file(resolve(directory, name));
const html = await read("index.html").text();
const snapshot = await read("status.json").json();
assert.equal(snapshot.schema, "d0.public-status.v1");
assert.match(snapshot.observed_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
assert(html.includes(`data-observed="${snapshot.observed_at}"`));
if (role !== "observed") {
  for (const name of ["status.css", "status.js"]) {
    assert.deepEqual(await read(name).arrayBuffer(), await Bun.file(name).arrayBuffer());
  }
}

const digest = (payload: string | ArrayBuffer) =>
  new Bun.CryptoHasher("sha256").update(payload).digest("hex");
const filesByHash: Record<string, string> = {};
for (const name of expected) filesByHash[name] = digest(await read(name).arrayBuffer());
console.log(JSON.stringify({
  schemaVersion: 1,
  role,
  source: role === "observed" ? "https://status.d0.eu/" : source,
  platform: "browser-static",
  sha256: digest(JSON.stringify(filesByHash)),
  files: filesByHash,
  observedAt: snapshot.observed_at,
  checkedAt: new Date().toISOString(),
}, null, 2));
