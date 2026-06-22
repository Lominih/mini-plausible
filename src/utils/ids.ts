import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";

const DEVICE_ID_COOKIE = "_plausible_device";
const SESSION_ID_COOKIE = "_plausible_session";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function generateDeviceId(): string {
  return uuidv4().replace(/-/g, "");
}

export function generateSessionId(): string {
  return uuidv4().replace(/-/g, "");
}

export function hashIP(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export function parseCookieHeader(
  cookieHeader: string | undefined
): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.split("=");
    if (!rawKey) continue;
    const key = rawKey.trim();
    const value = rest.join("=").trim();
    cookies[key] = value;
  }

  return cookies;
}

export function extractDeviceId(
  cookieHeader: string | undefined,
  headerDeviceId: string | undefined
): string {
  const cookies = parseCookieHeader(cookieHeader);
  return cookies[DEVICE_ID_COOKIE] || headerDeviceId || generateDeviceId();
}

export function extractSessionId(
  cookieHeader: string | undefined,
  headerSessionId: string | undefined,
  sessionExpiresAt: number | undefined
): { sessionId: string; isNew: boolean } {
  const cookies = parseCookieHeader(cookieHeader);
  const existingSessionId = cookies[SESSION_ID_COOKIE] || headerSessionId;

  if (
    existingSessionId &&
    sessionExpiresAt &&
    Date.now() < sessionExpiresAt
  ) {
    return { sessionId: existingSessionId, isNew: false };
  }

  return { sessionId: generateSessionId(), isNew: true };
}

export { DEVICE_ID_COOKIE, SESSION_ID_COOKIE, SESSION_TIMEOUT_MS };
