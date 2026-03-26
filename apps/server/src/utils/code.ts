import crypto from "node:crypto";
import { query } from "../db/client";

const CODE_LENGTH = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
const MAX_ATTEMPTS = 10;

export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const bytes = crypto.randomBytes(CODE_LENGTH);
    const code = Array.from(bytes)
      .map((b) => CODE_CHARS[b % CODE_CHARS.length])
      .join("");

    const existing = await query("SELECT 1 FROM games WHERE code = $1", [code]);
    if (existing.rowCount === 0) return code;
  }
  throw new Error("Failed to generate unique game code");
}
