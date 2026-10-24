import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];

function repositoryWith(content: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), "pii-gate-"));
  directories.push(directory);
  execFileSync("git", ["init", "-q"], { cwd: directory });
  execFileSync("git", ["config", "user.name", "Test Runner"], { cwd: directory });
  execFileSync("git", ["config", "user.email", "runner@users.noreply.github.com"], { cwd: directory });
  writeFileSync(path.join(directory, "sample.txt"), content);
  cpSync(path.join(process.cwd(), "scripts", "pii-gate.sh"), path.join(directory, "pii-gate.sh"));
  execFileSync("git", ["add", "."], { cwd: directory });
  execFileSync("git", ["commit", "-qm", "test fixture"], { cwd: directory });
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("PII gate", () => {
  it("許可されていない架空メールを検出して exit 1", () => {
    const address = ["person", "invalid.test"].join("@");
    const directory = repositoryWith(address);
    expect(() => execFileSync("bash", ["pii-gate.sh"], { cwd: directory, stdio: "pipe" })).toThrow();
  });

  it("example.com のメールだけなら exit 0", () => {
    const directory = repositoryWith("sample@example.com");
    expect(() => execFileSync("bash", ["pii-gate.sh"], { cwd: directory, stdio: "pipe" })).not.toThrow();
  });
});
