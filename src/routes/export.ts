import { Router, Response } from "express";
import { prisma } from "../utils/prisma";
import { handleError, notFound } from "../utils/errors";
import { AuthenticatedRequest, verifySiteAccess } from "../middleware/auth";

const router = Router();

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(toCsvValue).join(",")];
  for (const row of rows) {
    lines.push(row.map(toCsvValue).join(","));
  }
  return lines.join("\n");
}



router.get("/:siteId", async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const siteId = String(req.params.siteId);
    const rawFormat = (req.query.format as string) || "json";
    const format = ["json", "csv"].includes(rawFormat) ? rawFormat : "json";

    const site = await prisma.site.findFirst({ where: { id: siteId } });
    if (!site) {
      notFound(res, "Site");
      return;
    }

    const membership = await verifySiteAccess(req.user.userId, siteId);
    if (!membership) {
      notFound(res, "Site");
      return;
    }

    const [definitions, events, pageviews, funnels] = await Promise.all([
      prisma.eventDefinition.findMany({ where: { siteId } }),
      prisma.event.findMany({
        where: { siteId },
        orderBy: { createdAt: "desc" },
        take: 10000,
      }),
      prisma.pageview.findMany({
        where: { siteId },
        orderBy: { createdAt: "desc" },
        take: 10000,
      }),
      prisma.funnel.findMany({
        where: { siteId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Compute aggregates
    const eventAggregates: Record<string, { count: number; visitors: Set<string> }> = {};
    for (const event of events) {
      if (!eventAggregates[event.name]) {
        eventAggregates[event.name] = { count: 0, visitors: new Set() };
      }
      eventAggregates[event.name].count++;
      if (event.deviceId) eventAggregates[event.name].visitors.add(event.deviceId);
    }

    const aggregatedEvents = Object.entries(eventAggregates).map(([name, data]) => ({
      name,
      total: data.count,
      uniqueVisitors: data.visitors.size,
    }));

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="site-${siteId}-export.csv"`);

      const eventHeaders = [
        "id", "name", "url", "referrer", "props", "deviceId",
        "sessionId", "browser", "os", "country", "city", "createdAt",
      ];
      const eventRows = events.map((e) => [
        e.id, e.name, e.url, e.referrer ?? "", e.props,
        e.deviceId ?? "", e.sessionId ?? "", e.browser ?? "", e.os ?? "",
        e.country ?? "", e.city ?? "", e.createdAt.toISOString(),
      ]);

      const csvParts = [
        "# Events",
        toCsv(eventHeaders, eventRows),
        "",
        "# Aggregated Events",
        toCsv(["name", "total", "uniqueVisitors"], aggregatedEvents.map((e) => [e.name, e.total, e.uniqueVisitors])),
        "",
        "# Event Definitions",
        toCsv(
          ["id", "name", "propertiesSchema"],
          definitions.map((d) => [d.id, d.name, d.propertiesSchema])
        ),
      ];

      res.send(csvParts.join("\n"));
      return;
    }

    // JSON export
    const exportData = {
      site: {
        id: site.id,
        domain: site.domain,
        name: site.name,
        timezone: site.timezone,
        createdAt: site.createdAt,
      },
      eventDefinitions: definitions.map((d) => ({
        id: d.id,
        name: d.name,
        propertiesSchema: JSON.parse(d.propertiesSchema),
        createdAt: d.createdAt,
      })),
      events: events.map((e) => ({
        id: e.id,
        name: e.name,
        url: e.url,
        referrer: e.referrer,
        properties: JSON.parse(e.props),
        deviceId: e.deviceId,
        sessionId: e.sessionId,
        browser: e.browser,
        os: e.os,
        country: e.country,
        city: e.city,
        utmSource: e.utmSource,
        utmMedium: e.utmMedium,
        utmCampaign: e.utmCampaign,
        createdAt: e.createdAt,
      })),
      pageviews: pageviews.map((p) => ({
        id: p.id,
        url: p.url,
        referrer: p.referrer,
        userId: p.userId,
        sessionId: p.sessionId,
        browser: p.browser,
        os: p.os,
        country: p.country,
        device: p.device,
        duration: p.duration,
        createdAt: p.createdAt,
      })),
      aggregatedEvents,
      funnels: funnels.map((f) => ({
        id: f.id,
        name: f.name,
        steps: JSON.parse(f.steps),
        createdAt: f.createdAt,
      })),
      exportedAt: new Date().toISOString(),
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="site-${siteId}-export.json"`);
    res.json(exportData);
  } catch (error) {
    handleError(res, error, "Failed to export data");
  }
});

export default router;