import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = {
  env: path.join(repoRoot, ".env"),
  devVars: path.join(repoRoot, ".dev.vars"),
  wrangler: path.join(repoRoot, "wrangler.toml")
};

const requiredFirebaseFields = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID"
];

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function trimTrailingSlash(value) {
  return value.trim().replace(/\/+$/, "");
}

async function ask(question, defaultValue = "") {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue;
}

async function askRequired(question, defaultValue = "") {
  while (true) {
    const answer = await ask(question, defaultValue);
    if (answer) {
      return answer;
    }

    console.log("This value is required.");
  }
}

async function askYesNo(question, defaultValue = false) {
  const label = defaultValue ? "Y/n" : "y/N";
  const answer = (await rl.question(`${question} (${label}): `)).trim().toLowerCase();

  if (!answer) {
    return defaultValue;
  }

  return answer === "y" || answer === "yes";
}

async function writeFileIfAllowed(filePath, content) {
  if (await pathExists(filePath)) {
    const overwrite = await askYesNo(`${path.basename(filePath)} already exists. Overwrite it?`, false);
    if (!overwrite) {
      console.log(`Skipped ${path.relative(repoRoot, filePath)}.`);
      return false;
    }
  }

  await fs.writeFile(filePath, content, "utf8");
  console.log(`Wrote ${path.relative(repoRoot, filePath)}.`);
  return true;
}

function createEnvFile(firebaseConfig) {
  return `${requiredFirebaseFields
    .map((fieldName) => `${fieldName}=${firebaseConfig[fieldName]}`)
    .join("\n")}\n`;
}

function createDevVarsFile(sessionSecret, firebaseProjectId) {
  return [
    `SESSION_SECRET=${sessionSecret}`,
    `FIREBASE_PROJECT_ID=${firebaseProjectId}`,
    ""
  ].join("\n");
}

function createWranglerToml({
  workerName,
  firebaseProjectId,
  d1DatabaseName,
  d1DatabaseId,
  r2BucketName
}) {
  return [
    `name = "${workerName}"`,
    `main = "./apps/api/src/index.ts"`,
    `compatibility_date = "2026-04-13"`,
    "",
    "[vars]",
    `FIREBASE_PROJECT_ID = "${firebaseProjectId}"`,
    "",
    "[[d1_databases]]",
    `binding = "bookmark"`,
    `database_name = "${d1DatabaseName}"`,
    `database_id = "${d1DatabaseId}"`,
    `migrations_dir = "./apps/api/migrations"`,
    "",
    "[[r2_buckets]]",
    `binding = "bookmark_assets"`,
    `bucket_name = "${r2BucketName}"`,
    "",
    "[assets]",
    `directory = "./apps/web/dist"`,
    `binding = "ASSETS"`,
    `not_found_handling = "single-page-application"`,
    `run_worker_first = ["/api/*"]`,
    ""
  ].join("\n");
}

function printNextSteps(sessionSecret) {
  console.log("");
  console.log("Setup files are ready.");
  console.log("");
  console.log("Next steps:");
  console.log("1. Enable Google sign-in in Firebase Authentication.");
  console.log("2. Add localhost and your deployed Worker domain to Firebase authorized domains.");
  console.log("3. Create the Cloudflare D1 database and R2 bucket if you have not already done so.");
  console.log("4. Store the production session secret in Cloudflare:");
  console.log("");
  console.log("   npx wrangler secret put SESSION_SECRET");
  console.log("");
  console.log("   Paste this value when Wrangler asks for it:");
  console.log("");
  console.log(`   ${sessionSecret}`);
  console.log("");
  console.log("5. Verify local configuration:");
  console.log("");
  console.log("   npm run setup:check");
  console.log("");
  console.log("6. Build and deploy:");
  console.log("");
  console.log("   npm run deploy");
  console.log("");
}

const rl = readline.createInterface({ input, output });

try {
  console.log("");
  console.log("Bookmark self-host setup");
  console.log("========================");
  console.log("");
  console.log("This writes local-only config files. They are ignored by git.");
  console.log("");

  const firebaseConfig = {};
  for (const fieldName of requiredFirebaseFields) {
    firebaseConfig[fieldName] = await askRequired(fieldName);
  }

  const firebaseProjectId = firebaseConfig.VITE_FIREBASE_PROJECT_ID;
  const workerName = await askRequired("Cloudflare Worker name", "my-bookmark");
  const d1DatabaseName = await askRequired("Cloudflare D1 database name", workerName);
  const d1DatabaseId = await askRequired("Cloudflare D1 database id");
  const r2BucketName = await askRequired("Cloudflare R2 bucket name", `${workerName}-assets`);
  const workerUrl = trimTrailingSlash(
    await ask("Deployed Worker URL for extension setup docs", `https://${workerName}.<account>.workers.dev`)
  );
  const sessionSecret = crypto.randomBytes(32).toString("hex");

  await writeFileIfAllowed(files.env, createEnvFile(firebaseConfig));
  await writeFileIfAllowed(files.devVars, createDevVarsFile(sessionSecret, firebaseProjectId));
  await writeFileIfAllowed(
    files.wrangler,
    createWranglerToml({
      workerName,
      firebaseProjectId,
      d1DatabaseName,
      d1DatabaseId,
      r2BucketName
    })
  );

  console.log(`Extension API URL: ${workerUrl}`);
  printNextSteps(sessionSecret);
} finally {
  rl.close();
}
