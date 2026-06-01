import crypto from "crypto";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateEnrollCode(): string {
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}

export function parseEmailList(input: string): string[] {
  const parts = input
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const emails: string[] = [];
  for (const p of parts) {
    if (p.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) {
      emails.push(p);
    }
  }
  return [...new Set(emails)];
}
