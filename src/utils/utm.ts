import { URL } from "url";
import { UTMParams } from "../types";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export function extractUTMParams(
  url: string,
  body?: Record<string, string>
): UTMParams {
  const params: UTMParams = {};

  try {
    const parsed = new URL(url);
    for (const key of UTM_KEYS) {
      const value = parsed.searchParams.get(key);
      if (value) {
        params[key] = value;
      }
    }
  } catch {
    // Invalid URL ¡ª ignore
  }

  if (body) {
    for (const key of UTM_KEYS) {
      if (!params[key] && body[key]) {
        params[key] = body[key];
      }
    }
  }

  return params;
}
