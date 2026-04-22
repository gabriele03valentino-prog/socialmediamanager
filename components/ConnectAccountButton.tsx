import Link from "next/link";
import type { Platform } from "@prisma/client";
import { PLATFORM_LABEL } from "@/lib/utils";

// Ogni pulsante punta a /api/connect/<platform>/start che avvierà l'OAuth.
// Nei milestone M1-M4 ogni route verrà implementata.
export function ConnectAccountButton({
  platform,
  connected,
  handle,
}: {
  platform: Platform;
  connected: boolean;
  handle?: string;
}) {
  const href = `/api/connect/${platform.toLowerCase()}/start`;
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <div className="font-medium">{PLATFORM_LABEL[platform]}</div>
        <div className="text-sm text-neutral-500">
          {connected ? (handle ?? "collegato") : "non collegato"}
        </div>
      </div>
      <Link
        href={href}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700"
      >
        {connected ? "Riconnetti" : "Connetti"}
      </Link>
    </div>
  );
}
