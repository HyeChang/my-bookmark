import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const configFiles = {
  env: ".env",
  devVars: ".dev.vars",
  wrangler: "wrangler.toml"
};

const requiredEnvKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID"
];

const requiredDevVarsKeys = ["SESSION_SECRET", "FIREBASE_PROJECT_ID"];

function resolveRepoPath(relativePath) {
  return path.resolve(repoRoot, relativePath);
}

async function readText(relativePath) {
  const fullPath = resolveRepoPath(relativePath);
  return fs.readFile(fullPath, "utf8");
}

function parseKeyValueFile(content) {
  const values = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values.set(key, value);
  }

  return values;
}

function isPlaceholder(value) {
  return /your-|<account>|example|change-me/i.test(value);
}

function requireKeys(fileLabel, values, keys, errors) {
  for (const key of keys) {
    const value = values.get(key) || "";
    if (!value) {
      errors.push(`${fileLabel}: missing ${key}`);
      continue;
    }

    if (isPlaceholder(value)) {
      errors.push(`${fileLabel}: ${key} still looks like a placeholder`);
    }
  }
}

function checkWranglerToml(content, errors) {
  const requiredSnippets = [
    "name =",
    'main = "./apps/api/src/index.ts"',
    "[vars]",
    "FIREBASE_PROJECT_ID",
    "[[d1_databases]]",
    'binding = "bookmark"',
    "database_id =",
    "[[r2_buckets]]",
    'binding = "bookmark_assets"',
    "bucket_name =",
    "[assets]"
  ];

  for (const snippet of requiredSnippets) {
    if (!content.includes(snippet)) {
      errors.push(`wrangler.toml: missing ${snippet}`);
    }
  }

  if (isPlaceholder(content)) {
    errors.push("wrangler.toml: replace placeholder values before deploying");
  }
}

async function main() {
  const errors = [];
  const warnings = [];

  let envContent = "";
  let devVarsContent = "";
  let wranglerContent = "";

  try {
    envContent = await readText(configFiles.env);
  } catch {
    errors.push(".env: file not found. Run npm run setup.");
  }

  try {
    devVarsContent = await readText(configFiles.devVars);
  } catch {
    warnings.push(".dev.vars: file not found. Local Wrangler dev may need SESSION_SECRET and FIREBASE_PROJECT_ID.");
  }

  try {
    wranglerContent = await readText(configFiles.wrangler);
  } catch {
    errors.push("wrangler.toml: file not found. Run npm run setup.");
  }

  if (envContent) {
    requireKeys(".env", parseKeyValueFile(envContent), requiredEnvKeys, errors);
  }

  if (devVarsContent) {
    requireKeys(".dev.vars", parseKeyValueFile(devVarsContent), requiredDevVarsKeys, warnings);
  }

  if (wranglerContent) {
    checkWranglerToml(wranglerContent, errors);
  }

  if (errors.length > 0) {
    console.error("");
    console.error("Self-host setup check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error("");
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn("");
    console.warn("Self-host setup warnings:");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
    console.warn("");
  }

  console.log("Self-host setup check passed.");
}

await main();
