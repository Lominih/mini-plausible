import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { handleError, notFound } from "../utils/errors";
import { AuthenticatedRequest, verifySiteAccess } from "../middleware/auth";
import { calculateFunnel, saveFunnel, FunnelStep } from "../services/funnel";

const router = Router();

const funnelStepSchema = z.object({
  type: z.enum(["event", "page"]),
  value: z.string().min(1),
});

const createFunnelSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1).max(128),
  steps: z.array(funnelStepSchema).min(2).max(10),
});



router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const siteId = req.query.siteId as string;
    if (!siteId) {
      res.status(400).json({ error: "siteId query parameter is required" });
      return;
    }

    const membership = await verifySiteAccess(req.user.userId, siteId);
    if (!membership) {
      notFound(res, "Site");
      return;
    }

    // If funnelId provided, run that funnel
    const funnelId = req.query.funnelId as string | undefined;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    if (funnelId) {
      const result = await calculateFunnel({ funnelId, siteId, startDate, endDate });
      res.json(result);
      return;
    }

    // If inline steps provided
    if (req.query.steps) {
      let steps: FunnelStep[];
      try {
        const parsedSteps = JSON.parse(req.query.steps as string);
        if (!Array.isArray(parsedSteps) || parsedSteps.length < 2) {
          res.status(400).json({ error: "Steps must be an array with at least 2 items" });
          return;
        }
        const stepsResult = z.array(funnelStepSchema).min(2).max(10).safeParse(parsedSteps);
        if (!stepsResult.success) {
          res.status(400).json({ error: "Invalid steps", details: stepsResult.error.issues });
          return;
        }
        steps = stepsResult.data;
      } catch {
        res.status(400).json({ error: "Invalid steps JSON" });
        return;
      }
      const result = await calculateFunnel({ siteId, steps, startDate, endDate });
      res.json(result);
      return;
    }

    // List saved funnels
    const funnels = await prisma.funnel.findMany({
      where: { siteId, userId: req.user.userId },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      funnels: funnels.map((f) => ({
        id: f.id,
        siteId: f.siteId,
        name: f.name,
        steps: JSON.parse(f.steps),
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    });
  } catch (error) {
    handleError(res, error, "Failed to query funnels");
  }
});

router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const body = createFunnelSchema.parse(req.body);

    const membership = await verifySiteAccess(req.user.userId, body.siteId);
    if (!membership) {
      notFound(res, "Site");
      return;
    }

    const funnel = await saveFunnel(body.siteId, req.user.userId, body.name, body.steps);
    res.status(201).json({ funnel });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    handleError(res, error, "Failed to save funnel");
  }
});

export default router;