#!/usr/bin/env node
// scripts/setup.mjs
//
// Setup interattivo per macOS:
// 1. Apre ogni URL in Chrome
// 2. Chiede i valori man mano
// 3. Auto-genera i secret locali (AUTH_SECRET, TOKEN_ENCRYPTION_KEY, CRON_SECRET)
// 4. Scrive .env
// 5. Applica lo schema a Postgres (prisma db push)
// 6. Avvia `pnpm dev` e apre http://localhost:3000 in Chrome
//
// Uso: `pnpm setup`

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = resolve(ROOT, ".env");

const rl = createInterface({ input, output });

// ---------- helpers di stile ----------

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[22m`,
  dim: (s) => `\x1b[2m${s}\x1b[22m`,
  green: (s) => `\x1b[32m${s}\x1b[39m`,
  yellow: (s) => `\x1b[33m${s}\x1b[39m`,
  cyan: (s) => `\x1b[36m${s}\x1b[39m`,
  red: (s) => `\x1b[31m${s}\x1b[39m`,
};

const log = (m) => console.log(m);
const step = (t) => log(`\n${c.bold(c.cyan("▶ " + t))}`);
const hint = (m) => log(c.dim("  " + m));
const ok = (m) => log(c.green("  ✓ " + m));

async function ask(question, { default: def = "" } = {}) {
  const preview = def && def.length > 50 ? def.slice(0, 47) + "…" : def;
  const suffix = def ? ` ${c.dim(`[${preview}]`)}` : "";
  const answer = (await rl.question(`  ${question}${suffix} `)).trim();
  return answer || def;
}

async function confirm(question, def = true) {
  const yn = def ? "Y/n" : "y/N";
  const a = (await rl.question(`  ${question} ${c.dim(`(${yn})`)} `)).trim().toLowerCase();
  if (!a) return def;
  return ["y", "yes", "s", "si", "sì"].includes(a);
}

async function pause(msg = "premi invio quando sei pronto…") {
  await rl.question(c.dim("  ↩  " + msg));
}

function openUrl(url) {
  hint(`apro in Chrome: ${url}`);
  const r = spawnSync("open", ["-a", "Google Chrome", url], { stdio: "ignore" });
  if (r.status !== 0) {
    // Chrome non installato → browser di default.
    spawnSync("open", [url], { stdio: "ignore" });
  }
}

function loadExistingEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const env = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function envLine(key, value) {
  const esc = String(value ?? "").replace(/"/g, '\\"');
  return `${key}="${esc}"`;
}

// ---------- flow ----------

async function main() {
  log(c.bold("\n🎵  SMM Studio — setup interattivo\n"));
  hint("Apro gli URL giusti in Chrome; tu incolli i valori qui sotto.");
  hint("Puoi sempre ri-lanciare `pnpm setup` per cambiare qualcosa.\n");

  let existing = loadExistingEnv();
  if (Object.keys(existing).length > 0) {
    log(c.yellow(`  Trovato .env esistente (${Object.keys(existing).length} variabili).`));
    const keep = await confirm("Partire dai valori esistenti?", true);
    if (!keep) existing = {};
  }
  const env = { ...existing };

  // 1) secret locali
  step("1/5 Secret locali (auto-generati)");
  if (!env.AUTH_SECRET) env.AUTH_SECRET = randomBytes(32).toString("base64");
  if (!env.TOKEN_ENCRYPTION_KEY) env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  if (!env.CRON_SECRET) env.CRON_SECRET = randomBytes(16).toString("hex");
  if (!env.NEXTAUTH_URL) env.NEXTAUTH_URL = "http://localhost:3000";
  ok("AUTH_SECRET, TOKEN_ENCRYPTION_KEY, CRON_SECRET generati");

  // 2) Neon Postgres
  step("2/5 Neon Postgres (database gratuito)");
  hint("Dopo aver creato il progetto, copia la 'Pooled connection string'.");
  hint("Seleziona region EU (Frankfurt) per latenza Italia.");
  openUrl("https://console.neon.tech/signup");
  env.DATABASE_URL = await ask("DATABASE_URL:", { default: env.DATABASE_URL });

  // 3) Anthropic
  step("3/5 Anthropic (motore di suggerimenti Claude)");
  hint("Click 'Create Key' e incolla qui la chiave (inizia con sk-ant-).");
  openUrl("https://console.anthropic.com/settings/keys");
  env.ANTHROPIC_API_KEY = await ask("ANTHROPIC_API_KEY:", {
    default: env.ANTHROPIC_API_KEY,
  });

  // 4) Google OAuth (login app)
  step("4/5 Google OAuth (login dell'app)");
  hint("① Crea un progetto Google Cloud (puoi riusarne uno esistente).");
  openUrl("https://console.cloud.google.com/projectcreate");
  await pause("progetto creato? invio");

  hint("② OAuth consent screen → External → compila i campi base (nome app,");
  hint("   email di supporto). Puoi saltare scope/test users per ora.");
  openUrl("https://console.cloud.google.com/apis/credentials/consent");
  await pause("consent screen salvato? invio");

  hint("③ Credentials → Create Credentials → OAuth client ID → Web application.");
  hint("   Authorized redirect URI (esattamente questo):");
  log("   " + c.bold("http://localhost:3000/api/auth/callback/google"));
  openUrl("https://console.cloud.google.com/apis/credentials");
  env.AUTH_GOOGLE_ID = await ask("AUTH_GOOGLE_ID:", { default: env.AUTH_GOOGLE_ID });
  env.AUTH_GOOGLE_SECRET = await ask("AUTH_GOOGLE_SECRET:", {
    default: env.AUTH_GOOGLE_SECRET,
  });

  // 5) Meta
  step("5/5 Meta (Instagram + Facebook)");
  const doMeta = await confirm("Configurare Meta adesso?", true);
  if (doMeta) {
    hint("① Crea app tipo 'Business'.");
    openUrl("https://developers.facebook.com/apps/create/");
    await pause("app creata? invio");
    hint("② Add Product → 'Instagram' (Graph API) e 'Facebook Login for Business'.");
    hint("③ Facebook Login for Business → Settings → Valid OAuth Redirect URIs:");
    log("   " + c.bold("http://localhost:3000/api/connect/meta/callback"));
    hint("④ App Roles → Roles → aggiungi te stesso come Tester.");
    hint("⑤ Il tuo IG deve essere Business/Creator e collegato alla Pagina FB.");
    hint("⑥ Settings → Basic → copia App ID e App Secret.");
    env.META_CLIENT_ID = await ask("META_CLIENT_ID:", { default: env.META_CLIENT_ID });
    env.META_CLIENT_SECRET = await ask("META_CLIENT_SECRET:", {
      default: env.META_CLIENT_SECRET,
    });
  } else {
    env.META_CLIENT_ID ??= "";
    env.META_CLIENT_SECRET ??= "";
  }

  // Altre piattaforme: lasciate vuote finché non collegate dall'app.
  // YouTube riusa AUTH_GOOGLE_ID/SECRET, quindi non ha env dedicate.
  for (const k of [
    "TIKTOK_CLIENT_KEY",
    "TIKTOK_CLIENT_SECRET",
    "SPOTIFY_CLIENT_ID",
    "SPOTIFY_CLIENT_SECRET",
  ]) {
    env[k] ??= "";
  }

  // Allowlist email (consigliato per deploy pubblico)
  step("Allowlist email (consigliato per il deploy)");
  hint("In dev locale puoi lasciare vuoto. Una volta deployato su Vercel,");
  hint("metti i tuoi email separati da virgola — chi non è nella lista non");
  hint("riesce a fare login. Esempio: tua@gmail.com,collaboratore@gmail.com");
  env.AUTH_ALLOWED_EMAILS = await ask("AUTH_ALLOWED_EMAILS (vuoto = libero):", {
    default: env.AUTH_ALLOWED_EMAILS ?? "",
  });

  // scrivo .env
  step("Scrivo .env");
  const order = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "NEXTAUTH_URL",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "TOKEN_ENCRYPTION_KEY",
    "ANTHROPIC_API_KEY",
    "CRON_SECRET",
    "AUTH_ALLOWED_EMAILS",
    "META_CLIENT_ID",
    "META_CLIENT_SECRET",
    "TIKTOK_CLIENT_KEY",
    "TIKTOK_CLIENT_SECRET",
    "SPOTIFY_CLIENT_ID",
    "SPOTIFY_CLIENT_SECRET",
  ];
  const body =
    "# Generato da scripts/setup.mjs — ri-esegui `pnpm setup` per cambiare.\n\n" +
    order.map((k) => envLine(k, env[k])).join("\n") +
    "\n";
  writeFileSync(ENV_FILE, body, "utf8");
  ok(`scritto ${ENV_FILE}`);

  // applico schema
  step("Applico lo schema a Postgres");
  if (await confirm("Lanciare `pnpm prisma db push`?", true)) {
    const r = spawnSync("pnpm", ["prisma", "db", "push"], {
      stdio: "inherit",
      cwd: ROOT,
    });
    if (r.status !== 0) {
      log(c.red("  ⚠ db push fallito. Controlla DATABASE_URL e riprova a mano."));
    } else {
      ok("schema applicato");
    }
  }

  // avvio dev
  step("Tutto pronto 🎉");
  hint("Login con Google, poi Impostazioni → Connetti Instagram.");
  const doDev = await confirm("Avvio `pnpm dev` adesso?", true);
  rl.close();

  if (doDev) {
    // apri il browser quando il dev server probabilmente è up
    setTimeout(() => openUrl("http://localhost:3000"), 3500);
    spawn("pnpm", ["dev"], { stdio: "inherit", cwd: ROOT });
  } else {
    log("\n  Avvia a mano con: " + c.bold("pnpm dev"));
  }
}

main().catch((err) => {
  log(c.red("\n❌ errore: ") + (err?.message ?? err));
  rl.close();
  process.exit(1);
});
