import { execFileSync } from "node:child_process";
import path from "node:path";

import type { SourceLocation } from "./types";

const PACKAGE_DIR = __dirname;

let cachedGitRoot: string | null | false = null;

function getGitRoot(): string | null {
  if (cachedGitRoot === false) {
    return null;
  }

  if (typeof cachedGitRoot === "string") {
    return cachedGitRoot;
  }

  try {
    cachedGitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000
    }).trim();
    return cachedGitRoot;
  } catch {
    cachedGitRoot = false;
    return null;
  }
}

function relativePath(filePath: string): string {
  const normalized = path.normalize(filePath);
  const gitRoot = getGitRoot();

  if (gitRoot) {
    const relativeToGitRoot = path.relative(gitRoot, normalized);
    if (!relativeToGitRoot.startsWith("..")) {
      return relativeToGitRoot;
    }
  }

  const relativeToCwd = path.relative(process.cwd(), normalized);
  if (!relativeToCwd.startsWith("..")) {
    return relativeToCwd;
  }

  return normalized;
}

function shouldSkipStackFrame(filePath: string): boolean {
  if (!filePath) {
    return true;
  }

  const normalized = path.normalize(filePath);
  return (
    normalized.startsWith(PACKAGE_DIR) ||
    normalized.includes(`${path.sep}node_modules${path.sep}`) ||
    normalized.startsWith("node:internal") ||
    normalized.startsWith("internal") ||
    normalized.startsWith("<")
  );
}

function parseStackLine(line: string): { filePath?: string; lineNumber?: number } {
  const trimmed = line.trim();
  const withFunction = trimmed.match(/\((.+):(\d+):(\d+)\)$/);
  if (withFunction) {
    return { filePath: withFunction[1], lineNumber: Number(withFunction[2]) };
  }

  const withoutFunction = trimmed.match(/at (.+):(\d+):(\d+)$/);
  if (withoutFunction) {
    return { filePath: withoutFunction[1], lineNumber: Number(withoutFunction[2]) };
  }

  return {};
}

export function captureSourceLocation(functionName?: string): SourceLocation {
  const stack = new Error().stack?.split("\n") ?? [];

  for (const line of stack.slice(1)) {
    const { filePath, lineNumber } = parseStackLine(line);
    if (!filePath || shouldSkipStackFrame(filePath)) {
      continue;
    }

    return {
      gitSourceFile: relativePath(filePath),
      gitSourceLine: lineNumber,
      gitSourceFunction: functionName
    };
  }

  return { gitSourceFunction: functionName };
}

export function autoDetectGitContext(): { gitRepo?: string; gitRef?: string } {
  const result: { gitRepo?: string; gitRef?: string } = {};

  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000
    }).trim();

    const githubMatch = remote.match(
      /(?:https?:\/\/|ssh:\/\/git@|git@)github\.com[:/](.+?)(?:\.git)?$/,
    );
    if (githubMatch) {
      result.gitRepo = githubMatch[1].replace(/\/$/, "");
    }
  } catch {
    // Ignore git remote lookup failures.
  }

  try {
    result.gitRef = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000
    }).trim();
  } catch {
    // Ignore git ref lookup failures.
  }

  return result;
}
