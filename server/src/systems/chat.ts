import { CHAT_RATE_LIMIT_MS } from "@marea/shared";
import type { PrivatePlayer } from "../types.js";

export type ChatResult = { ok: true; text: string } | { ok: false; error: string };

// Remove ASCII control characters (0x00–0x1F and 0x7F) without embedding raw
// control bytes in source.
function stripControl(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x20 && c !== 0x7f) out += ch;
  }
  return out;
}

// Relay + rate limit + sanitize. Trims to 80 chars and strips control chars.
export function handleChat(priv: PrivatePlayer, raw: string, now: number): ChatResult {
  if (now - priv.lastChatAt < CHAT_RATE_LIMIT_MS) {
    return { ok: false, error: "You're chatting too fast." };
  }
  const text = stripControl(raw).trim().slice(0, 80);
  if (!text) return { ok: false, error: "Say something first." };
  priv.lastChatAt = now;
  return { ok: true, text };
}
