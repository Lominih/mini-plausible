import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { EventPayloadSchema, EventPayload, IngestResponse, BatchIngestResponse } from "../types";
import { parseUserAgent } from "../utils/user-agent";
import { extractUTMParams } from "../utils/utm";
import { extractDeviceId, extractSessionId, hashIP } from "../utils/ids";
import { withTimeout } from "../utils/timeout";

const router = Router();

const MAX_BATCH_SIZE = 100;
const GEO_TIMEOUT_MS = 2_000;

function getClientIP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "0.0.0.0";
}

async function lookupCountry(_ipHash: string): Promise<{ country: string; city: string }> {
  // In production, this would call an external GeoIP service.
  // Wrapped with timeout to prevent hanging on slow/unreachable services.
  return withTimeout(
    Promise.resolve({ country: "Unknown", city: "Unknown" }),
    GEO_TIMEOUT_MS,
    { country: "Unknown", city: "Unknown" },
  );
}

async function storeEvent(
  siteId: string,
  payload: EventPayload,
  req: Request
): Promise<IngestResponse> {
  const ua = parseUserAgent(req.headers["user-agent"]);
  const clientIP = getClientIP(req);
  const ipHash = hashIP(clientIP);
  const utm = extractUTMParams(payload.url, payload.utm as Record<string, string> | undefined);
  const deviceId = extractDeviceId(req.headers.cookie, req.headers["x-device-id"] as string | undefined);
  const { sessionId } = extractSessionId(
    req.headers.cookie,
    req.headers["x-session-id"] as string | undefined,
    undefined
  );
  const geo = await lookupCountry(ipHash);

  const referer = payload.referrer || req.headers.referer || null;

  const event = await prisma.event.create({
    data: {
      siteId,
      name: payload.name,
      url: payload.url,
      referrer: typeof referer === "string" ? referer : null,
      screenWidth: payload.screenWidth ?? null,
      screenHeight: payload.screenHeight ?? null,
      browser: ua.browser,
      os: ua.os,
      country: geo.country,
      city: geo.city,
      utmSource: utm.utm_source ?? null,
      utmMedium: utm.utm_medium ?? null,
      utmCampaign: utm.utm_campaign ?? null,
      deviceId,
      sessionId,
      props: JSON.stringify(payload.props || {}),
    },
  });

  return { success: true, eventId: event.id };
}

router.post("/api/event", async (req: Request, res: Response) => {
  try {
    const siteId = req.headers["x-site-id"] as string | undefined;
    if (!siteId) {
      res.status(400).json({ success: false, error: "Missing x-site-id header" });
      return;
    }

    const parsed = EventPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
      });
      return;
    }

    const result = await storeEvent(siteId, parsed.data, req);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Event ingest error:", message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.post("/api/events", async (req: Request, res: Response) => {
  try {
    const siteId = req.headers["x-site-id"] as string | undefined;
    if (!siteId) {
      res.status(400).json({ success: false, error: "Missing x-site-id header", eventIds: [], errors: [] });
      return;
    }

    const body = req.body;
    if (!Array.isArray(body)) {
      res.status(400).json({
        success: false,
        error: "Request body must be an array",
        eventIds: [],
        errors: [],
      });
      return;
    }

    if (body.length > MAX_BATCH_SIZE) {
      res.status(400).json({
        success: false,
        error: `Batch size exceeds limit of ${MAX_BATCH_SIZE} events (received ${body.length})`,
        eventIds: [],
        errors: [],
      });
      return;
    }

    const response: BatchIngestResponse = {
      success: true,
      eventIds: [],
      errors: [],
    };

    const validEvents: Array<{
      siteId: string; name: string; url: string; referrer: string | null;
      screenWidth: number | null; screenHeight: number | null;
      browser: string; os: string; country: string; city: string;
      utmSource: string | null; utmMedium: string | null; utmCampaign: string | null;
      deviceId: string; sessionId: string; props: string;
    }> = [];

    for (const item of body) {
      const parsed = EventPayloadSchema.safeParse(item);
      if (!parsed.success) {
        response.errors.push(
          parsed.error.issues.map((i) => i.message).join("; ")
        );
        response.success = false;
        continue;
      }

      try {
        const ua = parseUserAgent(req.headers["user-agent"]);
        const clientIP = getClientIP(req);
        const ipHash = hashIP(clientIP);
        const utm = extractUTMParams(parsed.data.url, parsed.data.utm as Record<string, string> | undefined);
        const deviceId = extractDeviceId(req.headers.cookie, req.headers["x-device-id"] as string | undefined);
        const { sessionId } = extractSessionId(
          req.headers.cookie,
          req.headers["x-session-id"] as string | undefined,
          undefined
        );
        const geo = await lookupCountry(ipHash);
        const referer = parsed.data.referrer || req.headers.referer || null;

        validEvents.push({
          siteId,
          name: parsed.data.name,
          url: parsed.data.url,
          referrer: typeof referer === "string" ? referer : null,
          screenWidth: parsed.data.screenWidth ?? null,
          screenHeight: parsed.data.screenHeight ?? null,
          browser: ua.browser,
          os: ua.os,
          country: geo.country,
          city: geo.city,
          utmSource: utm.utm_source ?? null,
          utmMedium: utm.utm_medium ?? null,
          utmCampaign: utm.utm_campaign ?? null,
          deviceId,
          sessionId,
          props: JSON.stringify(parsed.data.props || {}),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        response.errors.push(message);
        response.success = false;
      }
    }

    if (validEvents.length > 0) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.event.createMany({ data: validEvents });
        });
        response.eventIds = validEvents.map(() => "");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        response.errors.push(`Batch insert failed: ${message}`);
        response.success = false;
      }
    }

    const status = response.success ? 201 : 207;
    res.status(status).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Batch ingest error:", message);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      eventIds: [],
      errors: [],
    });
  }
});

export default router;
