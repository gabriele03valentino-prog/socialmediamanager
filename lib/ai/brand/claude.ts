// Client Anthropic condiviso dal modulo Brand (evita duplicati).
import Anthropic from "@anthropic-ai/sdk";

export const BRAND_MODEL = "claude-sonnet-4-6";

let _client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY non impostata");
  }
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}
