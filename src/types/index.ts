import { z } from "zod";

export const EventPayloadSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string(),
  referrer: z.string().optional(),
  screenWidth: z.number().int().optional(),
  screenHeight: z.number().int().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  utm: z
    .object({
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_campaign: z.string().optional(),
      utm_term: z.string().optional(),
      utm_content: z.string().optional(),
    })
    .optional(),
});

export type EventPayload = z.infer<typeof EventPayloadSchema>;

export interface IngestResponse {
  success: boolean;
  eventId?: string;
  error?: string;
}

export interface BatchIngestResponse {
  success: boolean;
  eventIds: string[];
  errors: string[];
}

export interface SiteConfig {
  id: string;
  name: string;
  domain: string;
  timezone: string;
}

export interface UserSession {
  deviceId: string;
  sessionId: string;
  ipHash: string;
}

export interface ParsedUserAgent {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
}

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}
