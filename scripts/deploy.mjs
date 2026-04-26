#!/usr/bin/env node
// scripts/deploy.mjs
//
// Deploy su Vercel in 3 mosse:
// 1. `vercel link` (interattivo) — collega questa cartella a un progetto Vercel
// 2. Sincronizza tutte le env var dal tuo .env locale alla "production" di Vercel
// 3. `vercel deploy --prod` — pubblica
//
// Uso: `pnpm deploy`
// Prerequisiti: account Vercel (gratis), .env locale già compilato.
// Vercel CLI viene scaricato al volo via `npx`.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = resolve(ROOT, ".env");
const LINK_FILE = resolve(ROOT, ".vercel/project.json");

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[22m`,
  dim: (s) => `\x1b[2m${s}\x1b[22m`,
  green: (s) => `\x1b[32m${s}\x1b[39m`,
  yellow: (s) => `\x1b[33m${s}\x1b[39m`,
  red: (s) => `\x1b[31m${s}\x1b[39m`,
  cyan: (s) => `\x1b[36m${s}\x1b[39m`,
};

// Variabili da spingere su Vercel. NEXTAUTH_URL è omessa di proposito:
// con `trustHost: true` Auth.js v5 ricava l'host dalle request headers di
// Vercel, evitando il mismatch tra dev e prod.
const PUSH_KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
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

function readEnv() {
  if (!existsSync(ENV_FILE)) {
    console.error(c.red("\n❌ File .env non trovato."));
    console.error(c.dim("   Esegui prima: pnpm configure"));
    process.exit(1);
  }
  const out = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function vercel(args, opts = {}) {
  return spawnSync("npx", ["-y", "vercel@latest", ...args], {
    stdio: opts.stdio ?? "inherit",
    cwd: ROOT,
    ...opts,
  });
}

function pushVar(key, value) {
  // Rimuovi prima così l'add non chiede conferma di overwrite.
  vercel(["env", "rm", key, "production", "--yes"], { stdio: "ignore" });
  // L'add legge da stdin.
  const r = spawnSync(
    "npx",
    ["-y", "vercel@latest", "env", "add", key, "production"],
    {
      cwd: ROOT,
      input: value + "\n",
      stdio: ["pipe", "ignore", "pipe"],
    },
  );
  return r.status === 0;
}

function main() {
  console.log(c.bold("\n🚀 SMM Studio — deploy su Vercel\n"));

  const env = readEnv();
  const present = PUSH_KEYS.filter((k) => env[k]);
  const missing = PUSH_KEYS.filter((k) => !env[k]);

  console.log(`📋 ${present.length} env var pronte; ${missing.length} vuote (verranno saltate).`);
  if (missing.length > 0 && missing.length < PUSH_KEYS.length) {
    console.log(c.dim(`   saltati: ${missing.join(", ")}`));
  }
  console.log();

  // 1. Link
  if (!existsSync(LINK_FILE)) {
    console.log(c.cyan(c.bold("1/3 Link progetto Vercel")));
    console.log(c.dim("    Segui le domande del CLI: scope, nome progetto, ecc."));
    console.log(c.dim("    Se è il primo deploy: rispondi 'y' a 'Set up and deploy?'\n"));
    const r = vercel(["link"]);
    if (r.status !== 0 || !existsSync(LINK_FILE)) {
      console.log(c.red("\n❌ Link fallito."));
      process.exit(1);
    }
    console.log();
  } else {
    console.log(c.green("✓ Progetto Vercel già linkato."));
    console.log();
  }

  // 2. Sync env vars
  console.log(c.cyan(c.bold("2/3 Sincronizzo env var su Vercel production")));
  let okCount = 0;
  let failCount = 0;
  for (const key of PUSH_KEYS) {
    if (!env[key]) continue;
    process.stdout.write(`    ${key}... `);
    const ok = pushVar(key, env[key]);
    if (ok) {
      console.log(c.green("✓"));
      okCount += 1;
    } else {
      console.log(c.red("✗"));
      failCount += 1;
    }
  }
  console.log(c.dim(`    ${okCount} sincronizzate, ${failCount} fallite.\n`));

  // 3. Deploy
  console.log(c.cyan(c.bold("3/3 Deploy in produzione")));
  const r = vercel(["deploy", "--prod"]);
  if (r.status !== 0) {
    console.log(c.red("\n❌ Deploy fallito. Controlla l'output sopra."));
    process.exit(1);
  }

  console.log(c.green(c.bold("\n🎉 Deploy completato!\n")));
  console.log("Prossimi passi sul tuo dashboard Vercel + dev console:");
  console.log(c.dim("  • Copia l'URL del deploy (riga 'Production: https://...' sopra)"));
  console.log(c.dim("  • Aggiungi gli stessi redirect URI delle dev console OAuth"));
  console.log(c.dim("    sostituendo localhost:3000 con il dominio Vercel:"));
  console.log(c.dim("      Google:  /api/auth/callback/google"));
  console.log(c.dim("               /api/connect/youtube/callback"));
  console.log(c.dim("      Meta:    /api/connect/meta/callback"));
  console.log(c.dim("      TikTok:  /api/connect/tiktok/callback"));
  console.log(c.dim("  • Push successivi al branch sono auto-deploy se hai abilitato"));
  console.log(c.dim("    l'integrazione GitHub su Vercel (Project → Settings → Git)\n"));
}

main();
