import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof buildClient> | undefined;
};

// Neon free tier auto-sospende il compute dopo ~5 min idle. La prima query
// dopo il wake up può fallire con "Error kind: Closed" o codici Prisma P1001/
// P1017. Avvolgiamo ogni operazione con un retry con backoff esponenziale
// corto (200/600/1800 ms), max 3 tentativi, così il tempo extra è invisibile
// all'utente nella stragrande maggioranza dei casi.

const TRANSIENT_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);
const TRANSIENT_MESSAGES = [
  "kind: Closed",
  "connection is closed",
  "Connection closed",
  "Closed",
  "ECONNRESET",
  "ETIMEDOUT",
  "socket hang up",
];

function isTransient(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_CODES.has(err.code);
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    // errorCode può essere undefined; trattiamo init error come transient
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message ?? "";
    return TRANSIENT_MESSAGES.some((m) => msg.includes(m));
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return base.$extends({
    name: "retry-on-transient",
    query: {
      async $allOperations({ operation, model, args, query }) {
        const delays = [200, 600, 1800];
        let attempt = 0;
        while (true) {
          try {
            return await query(args);
          } catch (err) {
            if (attempt >= delays.length || !isTransient(err)) {
              throw err;
            }
            if (process.env.NODE_ENV === "development") {
              const op = `${model ?? "raw"}.${operation}`;
              console.warn(
                `[prisma] ${op} transient error (attempt ${attempt + 1}/${delays.length}), retrying in ${delays[attempt]}ms`,
              );
            }
            await sleep(delays[attempt]!);
            attempt += 1;
          }
        }
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
