// Rate limiter in-memory minimale per proteggere le API che chiamano Anthropic.
//
// Premessa onesta: in serverless multi-istanza la memoria non è condivisa, quindi
// in produzione Vercel un attaccante che apre più connessioni può aggirare il
// limit. Per noi va comunque bene perché:
// - l'app è single-tenant (allowlist email + 1 utente reale)
// - il vero paracadute economico è il budget cap $5/mese su Anthropic Console
// - questo limiter serve a evitare che un click ripetuto, un bug nel client o
//   un loop accidentale brucino velocemente budget e tempo
//
// Quando avrà senso scalare a multi-utente, sostituire con Upstash Redis tenendo
// la stessa interfaccia di `checkRateLimit`.

type Bucket = number[];

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export function checkRateLimit(
  key: string,
  { max, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = buckets.get(key) ?? [];
  const recent = existing.filter((t) => t > cutoff);

  if (recent.length >= max) {
    const oldest = recent[0]!;
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    buckets.set(key, recent);
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  recent.push(now);
  buckets.set(key, recent);
  return {
    ok: true,
    remaining: max - recent.length,
    retryAfterSeconds: 0,
  };
}

import { NextResponse } from "next/server";

/**
 * Helper che applica il rate limit a una request autenticata e ritorna una
 * NextResponse 429 pronta se il limite è superato, oppure null se è OK.
 */
export function rateLimitOrResponse(
  userId: string,
  routeKey: string,
  opts: RateLimitOptions,
): NextResponse | null {
  const result = checkRateLimit(`${userId}:${routeKey}`, opts);
  if (result.ok) return null;
  return NextResponse.json(
    {
      error: `Hai raggiunto il limite per "${routeKey}". Riprova fra ${result.retryAfterSeconds}s.`,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}

// Limiti per route — calibrati su uso single-tenant realistico.
// `windowMs` espresso in ms costanti per leggibilità.
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const LIMITS = {
  suggestionsGenerate: { max: 3, windowMs: HOUR }, // piano settimanale, costoso
  brandStageNames: { max: 5, windowMs: DAY }, // 12-15 nomi per call
  brandIdentity: { max: 5, windowMs: DAY }, // identità completa, una tantum
  brandCoverBrief: { max: 10, windowMs: DAY }, // un brief per release
  marketingScore: { max: 30, windowMs: HOUR }, // on-demand su singolo draft
  marketingPersona: { max: 5, windowMs: DAY },
  marketingCampaign: { max: 5, windowMs: DAY },
} as const;
