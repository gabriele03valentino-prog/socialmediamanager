"use client";
import { useRouter } from "next/navigation";
import { Instagram, Music2, Youtube, Music } from "lucide-react";
import type { Platform } from "@prisma/client";

interface PlatformInfo {
  platform: Platform;
  label: string;
  Icon: typeof Instagram;
  href: string;
  note?: string;
}

const PLATFORMS: PlatformInfo[] = [
  {
    platform: "INSTAGRAM",
    label: "Instagram + Facebook",
    Icon: Instagram,
    href: "/api/connect/meta/start?next=/onboarding?step=4",
  },
  {
    platform: "TIKTOK",
    label: "TikTok",
    Icon: Music2,
    href: "/api/connect/tiktok/start?next=/onboarding?step=4",
  },
  {
    platform: "YOUTUBE",
    label: "YouTube",
    Icon: Youtube,
    href: "/api/connect/youtube/start?next=/onboarding?step=4",
  },
  {
    platform: "SPOTIFY",
    label: "Spotify (input manuale)",
    Icon: Music,
    href: "/onboarding?step=4",
    note: "Spotify non ha OAuth pubblico per artist data — userai input manuale",
  },
];

interface Props {
  connected: Platform[];
}

export function StepSocialConnect({ connected }: Props) {
  const router = useRouter();
  const hasAny = connected.length > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Collega almeno una piattaforma per dare a Claude dati reali su cui basare i suggerimenti.
        Puoi anche saltare e collegare dopo: il primo piano sarà generato senza metriche.
      </p>

      <ul className="space-y-2">
        {PLATFORMS.map((p) => {
          const isConnected = connected.includes(p.platform);
          return (
            <li
              key={p.platform}
              className="flex items-center justify-between rounded border border-gray-200 bg-white p-3"
            >
              <div className="flex items-center gap-3">
                <p.Icon className="h-5 w-5 text-gray-600" />
                <div>
                  <div className="text-sm font-medium">{p.label}</div>
                  {p.note && <div className="text-xs text-gray-500">{p.note}</div>}
                </div>
              </div>
              {isConnected ? (
                <span className="text-xs font-medium text-emerald-700">Connesso</span>
              ) : (
                <a
                  href={p.href}
                  className="rounded border border-violet-600 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50"
                >
                  Connetti
                </a>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={() => router.push("/onboarding?step=2")}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Indietro
        </button>
        <button
          type="button"
          onClick={() => router.push("/onboarding?step=4")}
          className="rounded bg-violet-600 px-5 py-2 text-sm font-medium text-white"
        >
          {hasAny ? "Avanti" : "Continua senza connettere"}
        </button>
      </div>
    </div>
  );
}
