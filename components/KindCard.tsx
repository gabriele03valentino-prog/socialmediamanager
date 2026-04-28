"use client";
import type { CreatorKind } from "@prisma/client";
import { KIND_DISPLAY } from "@/lib/kind-labels";
import { clsx } from "clsx";
import { Music, Video, Camera, BookOpen, Mic, Building2 } from "lucide-react";

const ICONS: Record<CreatorKind, typeof Music> = {
  ARTIST: Music,
  YOUTUBER: Video,
  INFLUENCER: Camera,
  DIVULGATORE: BookOpen,
  PODCASTER: Mic,
  BRAND: Building2,
};

const COLORS: Record<CreatorKind, { bg: string; text: string; border: string }> = {
  ARTIST: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-300" },
  YOUTUBER: { bg: "bg-red-50", text: "text-red-700", border: "border-red-300" },
  INFLUENCER: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-300" },
  DIVULGATORE: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  PODCASTER: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  BRAND: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
};

const DESCRIPTIONS: Record<CreatorKind, { tagline: string; example: string }> = {
  ARTIST: {
    tagline: "Musicista, producer, cantautore",
    example: "Reel snippet, drop singolo, clip studio",
  },
  YOUTUBER: {
    tagline: "Long-form video, tutorial, vlog",
    example: "Trailer, upload, Short di estratti",
  },
  INFLUENCER: {
    tagline: "Lifestyle, fashion, beauty",
    example: "Reel storytelling, carousel valore, story BTS",
  },
  DIVULGATORE: {
    tagline: "Educator, scienza, storia, tech",
    example: "Video lungo + clip, carousel didattico",
  },
  PODCASTER: {
    tagline: "Podcast audio, talk, interviste",
    example: "Audiogram, clip 30-60s, takeaway",
  },
  BRAND: {
    tagline: "Azienda, prodotto, marketplace",
    example: "Storytelling, UGC, case study",
  },
};

interface Props {
  kind: CreatorKind;
  selected?: boolean;
  onClick?: () => void;
}

export function KindCard({ kind, selected, onClick }: Props) {
  const Icon = ICONS[kind];
  const c = COLORS[kind];
  const d = DESCRIPTIONS[kind];

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition",
        selected ? `${c.border} ${c.bg}` : "border-gray-200 bg-white hover:border-gray-300",
      )}
    >
      <div className={clsx("rounded-md p-2", c.bg, c.text)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-semibold text-gray-900">{KIND_DISPLAY[kind]}</div>
      <div className="text-sm text-gray-600">{d.tagline}</div>
      <div className="text-xs text-gray-500">{d.example}</div>
    </button>
  );
}
