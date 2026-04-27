import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const PLATFORM_LABEL: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  SPOTIFY: "Spotify",
};

/**
 * Converte una Date in stringa "YYYY-MM-DDTHH:mm" nel fuso locale del browser,
 * formato accettato da `<input type="datetime-local">`. Se la data è null
 * ritorna stringa vuota.
 */
export function toDatetimeLocal(date: Date | null | undefined): string {
  if (!date) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
