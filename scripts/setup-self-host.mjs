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

const messages = {
  ko: {
    heading: "Bookmark 셀프 호스팅 설정",
    separator: "===========================",
    languagePrompt: "언어를 선택하세요 / Choose language (1=한국어, 2=English)",
    localOnly: "이 스크립트는 git에 커밋되지 않는 로컬 설정 파일을 생성합니다.",
    required: "필수 값입니다.",
    overwriteQuestion: (fileName) => `${fileName} 파일이 이미 있습니다. 덮어쓸까요?`,
    skipped: (filePath) => `${filePath} 생성을 건너뛰었습니다.`,
    wrote: (filePath) => `${filePath} 파일을 생성했습니다.`,
    workerName: "Cloudflare Worker 이름",
    d1DatabaseName: "Cloudflare D1 데이터베이스 이름",
    d1DatabaseId: "Cloudflare D1 database_id",
    r2BucketName: "Cloudflare R2 bucket 이름",
    workerUrl: "확장 프로그램 설정 안내에 사용할 배포 Worker URL",
    extensionApiUrl: "확장 프로그램 API URL",
    setupReady: "설정 파일 생성이 끝났습니다.",
    nextStepsTitle: "다음 단계:",
    nextSteps: [
      "1. Firebase Authentication에서 Google 로그인을 활성화합니다.",
      "2. Firebase Authorized domains에 localhost와 배포된 Worker 도메인을 추가합니다.",
      "3. 아직 만들지 않았다면 Cloudflare D1 데이터베이스와 R2 bucket을 생성합니다.",
      "4. 운영용 SESSION_SECRET을 Cloudflare Worker secret에 등록합니다:",
      "",
      "   npx wrangler secret put SESSION_SECRET",
      "",
      "   Wrangler가 값을 물어보면 아래 값을 붙여넣습니다:",
      "",
      "5. 로컬 설정을 검증합니다:",
      "",
      "   npm run setup:check",
      "",
      "6. 빌드 후 배포합니다:",
      "",
      "   npm run deploy"
    ]
  },
  en: {
    heading: "Bookmark self-host setup",
    separator: "========================",
    languagePrompt: "Choose language / 언어를 선택하세요 (1=한국어, 2=English)",
    localOnly: "This writes local-only config files. They are ignored by git.",
    required: "This value is required.",
    overwriteQuestion: (fileName) => `${fileName} already exists. Overwrite it?`,
    skipped: (filePath) => `Skipped ${filePath}.`,
    wrote: (filePath) => `Wrote ${filePath}.`,
    workerName: "Cloudflare Worker name",
    d1DatabaseName: "Cloudflare D1 database name",
    d1DatabaseId: "Cloudflare D1 database_id",
    r2BucketName: "Cloudflare R2 bucket name",
    workerUrl: "Deployed Worker URL for extension setup docs",
    extensionApiUrl: "Extension API URL",
    setupReady: "Setup files are ready.",
    nextStepsTitle: "Next steps:",
    nextSteps: [
      "1. Enable Google sign-in in Firebase Authentication.",
      "2. Add localhost and your deployed Worker domain to Firebase authorized domains.",
      "3. Create the Cloudflare D1 database and R2 bucket if you have not already done so.",
      "4. Store the production SESSION_SECRET in Cloudflare:",
      "",
      "   npx wrangler secret put SESSION_SECRET",
      "",
      "   Paste this value when Wrangler asks for it:",
      "",
      "5. Verify local configuration:",
      "",
      "   npm run setup:check",
      "",
      "6. Build and deploy:",
      "",
      "   npm run deploy"
    ]
  }
};

const rl = readline.createInterface({ input, output });

function parseLanguageArg() {
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--lang") {
      return args[index + 1] === "ko" ? "ko" : args[index + 1] === "en" ? "en" : null;
    }

    if (arg.startsWith("--lang=")) {
      const value = arg.slice("--lang=".length);
      return value === "ko" ? "ko" : value === "en" ? "en" : null;
    }
  }

  return null;
}

async function chooseLanguage() {
  const languageFromArg = parseLanguageArg();
  if (languageFromArg) {
    return languageFromArg;
  }

  while (true) {
    const answer = (await rl.question(`${messages.en.languagePrompt}: `)).trim().toLowerCase();

    if (!answer || answer === "2" || answer === "en" || answer === "english") {
      return "en";
    }

    if (answer === "1" || answer === "ko" || answer === "kr" || answer === "korean" || answer === "한국어") {
      return "ko";
    }

    console.log("Please enter 1, 2, ko, or en.");
  }
}

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

async function askRequired(question, t, defaultValue = "") {
  while (true) {
    const answer = await ask(question, defaultValue);
    if (answer) {
      return answer;
    }

    console.log(t.required);
  }
}

async function askYesNo(question, defaultValue = false) {
  const label = defaultValue ? "Y/n" : "y/N";
  const answer = (await rl.question(`${question} (${label}): `)).trim().toLowerCase();

  if (!answer) {
    return defaultValue;
  }

  return answer === "y" || answer === "yes" || answer === "예" || answer === "네";
}

async function writeFileIfAllowed(filePath, content, t) {
  if (await pathExists(filePath)) {
    const overwrite = await askYesNo(t.overwriteQuestion(path.basename(filePath)), false);
    if (!overwrite) {
      console.log(t.skipped(path.relative(repoRoot, filePath)));
      return false;
    }
  }

  await fs.writeFile(filePath, content, "utf8");
  console.log(t.wrote(path.relative(repoRoot, filePath)));
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

function printNextSteps(sessionSecret, t) {
  console.log("");
  console.log(t.setupReady);
  console.log("");
  console.log(t.nextStepsTitle);

  for (const line of t.nextSteps) {
    console.log(line);
    if (line.includes("Paste this value") || line.includes("아래 값을 붙여넣습니다")) {
      console.log("");
      console.log(`   ${sessionSecret}`);
      console.log("");
    }
  }

  console.log("");
}

try {
  const language = await chooseLanguage();
  const t = messages[language];

  console.log("");
  console.log(t.heading);
  console.log(t.separator);
  console.log("");
  console.log(t.localOnly);
  console.log("");

  const firebaseConfig = {};
  for (const fieldName of requiredFirebaseFields) {
    firebaseConfig[fieldName] = await askRequired(fieldName, t);
  }

  const firebaseProjectId = firebaseConfig.VITE_FIREBASE_PROJECT_ID;
  const workerName = await askRequired(t.workerName, t, "my-bookmark");
  const d1DatabaseName = await askRequired(t.d1DatabaseName, t, workerName);
  const d1DatabaseId = await askRequired(t.d1DatabaseId, t);
  const r2BucketName = await askRequired(t.r2BucketName, t, `${workerName}-assets`);
  const workerUrl = trimTrailingSlash(
    await ask(t.workerUrl, `https://${workerName}.<account>.workers.dev`)
  );
  const sessionSecret = crypto.randomBytes(32).toString("hex");

  await writeFileIfAllowed(files.env, createEnvFile(firebaseConfig), t);
  await writeFileIfAllowed(files.devVars, createDevVarsFile(sessionSecret, firebaseProjectId), t);
  await writeFileIfAllowed(
    files.wrangler,
    createWranglerToml({
      workerName,
      firebaseProjectId,
      d1DatabaseName,
      d1DatabaseId,
      r2BucketName
    }),
    t
  );

  console.log(`${t.extensionApiUrl}: ${workerUrl}`);
  printNextSteps(sessionSecret, t);
} finally {
  rl.close();
}
