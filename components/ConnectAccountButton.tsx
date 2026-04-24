import type { Platform } from "@prisma/client";
import { PLATFORM_LABEL } from "@/lib/utils";

// Ogni pulsante punta a /api/connect/<platform>/start che fa 307 verso
// l'URL OAuth della piattaforma (facebook.com, accounts.google.com,
// tiktok.com, …). Usiamo un normale <a> invece di next/link: il router
// di Next.js intercetterebbe il click e farebbe un fetch RSC che fallisce
// quando il redirect finale esce cross-origin ("Failed to fetch").
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
      <a
        href={href}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700"
      >
        {connected ? "Riconnetti" : "Connetti"}
      </a>
    </div>
  );
}
