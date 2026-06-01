import crypto from "crypto";

export function generateSessionSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getCurrentWindow(intervalSeconds: number): number {
  return Math.floor(Date.now() / 1000 / intervalSeconds);
}

export function buildQrToken(
  sessionId: string,
  secret: string,
  intervalSeconds: number,
  window?: number
): { token: string; window: number; expiresIn: number } {
  const w = window ?? getCurrentWindow(intervalSeconds);
  const payload = `${sessionId}:${w}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const token = Buffer.from(`${payload}:${hmac.slice(0, 16)}`).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const windowEnd = (w + 1) * intervalSeconds;
  const expiresIn = Math.max(1, windowEnd - now);
  return { token, window: w, expiresIn };
}

export function verifyQrToken(
  token: string,
  sessionId: string,
  secret: string,
  intervalSeconds: number
): { valid: boolean; window?: number; reason?: string } {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return { valid: false, reason: "Невірний формат токена" };
  }

  const parts = decoded.split(":");
  if (parts.length !== 3) {
    return { valid: false, reason: "Невірний формат токена" };
  }

  const [sid, windowStr, sig] = parts;
  if (sid !== sessionId) {
    return { valid: false, reason: "Токен не для цієї сесії" };
  }

  const window = parseInt(windowStr, 10);
  if (Number.isNaN(window)) {
    return { valid: false, reason: "Невірне вікно часу" };
  }

  const current = getCurrentWindow(intervalSeconds);
  if (window < current - 1 || window > current + 1) {
    return { valid: false, reason: "Токен прострочений" };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${sessionId}:${window}`)
    .digest("hex")
    .slice(0, 16);

  if (sig !== expected) {
    return { valid: false, reason: "Невірний підпис токена" };
  }

  return { valid: true, window };
}
