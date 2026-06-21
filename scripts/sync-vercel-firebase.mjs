import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sa = JSON.parse(readFileSync(resolve(root, "serviceAccountKey.json"), "utf8"));

const vars = [
  ["FIREBASE_PROJECT_ID", sa.project_id, false],
  ["FIREBASE_CLIENT_EMAIL", sa.client_email, true],
  ["FIREBASE_PRIVATE_KEY", sa.private_key.replace(/\n/g, "\\n"), true],
];

function setEnv(name, value, sensitive, target) {
  const args = [
    "env",
    "add",
    name,
    target,
    "--force",
    "--yes",
    "--non-interactive",
    "--value",
    value,
  ];
  if (sensitive) args.splice(5, 0, "--sensitive");

  const result = spawnSync("vercel", args, { cwd: root, stdio: "inherit", shell: true });
  if (result.status !== 0) throw new Error(`Failed: ${name} (${target})`);
}

for (const target of ["production", "preview"]) {
  console.log(`\n→ ${target}`);
  for (const [name, value, sensitive] of vars) {
    setEnv(name, value, sensitive, target);
  }
}

// Validate roundtrip locally
const normalized = vars[2][1].replace(/\\n/g, "\n");
if (normalized !== sa.private_key) throw new Error("Private key roundtrip failed");
console.log("\nPrivate key roundtrip OK");
