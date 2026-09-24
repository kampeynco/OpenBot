import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function runMigration(overrides: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), "openbot-migration-"));
  const executable = (name: string, body: string) => {
    const path = join(root, name);
    writeFileSync(path, `#!/bin/sh\n${body}\n`);
    chmodSync(path, 0o755);
  };
  try {
    executable("pg_isready", `
count=0
[ ! -f "$MIGRATION_TEST_ROOT/probes" ] || count=$(cat "$MIGRATION_TEST_ROOT/probes")
count=$((count + 1))
echo "$count" > "$MIGRATION_TEST_ROOT/probes"
[ "$count" -gt "$READY_AFTER" ]`);
    executable("sleep", "exit 0");
    executable("s6-setuidgid", `
printf '%s\\n' "$@" > "$MIGRATION_TEST_ROOT/migration"
exit "\${MIGRATION_EXIT:-0}"`);
    const script = readFileSync(join(import.meta.dir, "migrate.sh"), "utf8")
      .replace("cd /app/server", 'cd "$MIGRATION_TEST_ROOT"');
    const path = join(root, "migrate.sh");
    writeFileSync(path, script);
    const result = Bun.spawnSync(["/bin/sh", path], {
      env: {
        PATH: `${root}:/usr/bin:/bin`,
        MIGRATION_TEST_ROOT: root,
        EMBEDDED_POSTGRES: "on",
        READY_AFTER: "0",
        ...overrides,
      },
    });
    const read = (name: string) => {
      try { return readFileSync(join(root, name), "utf8"); }
      catch { return ""; }
    };
    return {
      code: result.exitCode,
      probes: Number(read("probes")),
      migration: read("migration"),
      stderr: result.stderr.toString(),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("external databases do not trigger embedded readiness or migration", () => {
  const result = runMigration({ EMBEDDED_POSTGRES: "off" });
  expect(result.code).toBe(0);
  expect(result.probes).toBe(0);
  expect(result.migration).toBe("");
});

test("migrations wait for a database that initially rejects connections", () => {
  const result = runMigration({ READY_AFTER: "3" });
  expect(result.code).toBe(0);
  expect(result.probes).toBe(4);
  expect(result.migration).toBe("apiuser\n/usr/local/bin/bun\nscripts/migrate.ts\n");
});

test("an unavailable database fails startup without attempting migrations", () => {
  const result = runMigration({ READY_AFTER: "999" });
  expect(result.code).toBe(1);
  expect(result.migration).toBe("");
  expect(result.stderr).toContain("PostgreSQL did not become ready");
});

test("migration failures still fail startup after readiness succeeds", () => {
  expect(runMigration({ MIGRATION_EXIT: "17" }).code).toBe(17);
});
